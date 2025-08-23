import { notFound } from "next/navigation";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { BLOOM_LEVELS, BLOOM_COLOR_HEX } from "@/types/card-catalog";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";
import { fetchProgress } from "@/lib/quest/repo";
import * as cardsRepo from "@/lib/cardsRepo";
import { Lock as LockIcon } from "lucide-react";
import { getSupabaseSession } from "@/lib/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Server-side page that renders the mission selection UI (formerly modal) as a full page.
export default async function QuestEnterPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const id = Number(deckId);
  if (!Number.isFinite(id)) notFound();

  type BP = { totalCards?: number; missionsCompleted?: number; mastered?: boolean; accuracySum?: number; accuracyCount?: number; cleared?: boolean; weightedAvg?: number };
  let per: Partial<Record<DeckBloomLevel, BP & { updatedSinceLastRun?: number }>> = {};
  let levels: Array<{
    level: DeckBloomLevel;
    totalCards: number;
    missionsCompleted: number;
    totalMissions: number;
    mastered: boolean;
    unlocked: boolean;
    updatedSinceLastRun: number;
  }> = [];
  // Collect unlock reasoning for a lightweight debug panel
  const unlockWhy: Array<{ level: DeckBloomLevel; prevMastered: boolean; prevCleared: boolean; prevAvg: number; prevHasMission: boolean }> = [];

  try {
    // Prefer direct DB read with server session to avoid missing cookies when calling our API from a server component
    const session = await getSupabaseSession();
    if (session?.user?.id) {
      const sb = supabaseAdmin();
      const { data } = await sb
        .from("user_deck_quest_progress")
        .select("per_bloom")
        .eq("user_id", session.user.id)
        .eq("deck_id", id)
        .maybeSingle();
      if (data?.per_bloom) per = (data.per_bloom as unknown) as typeof per;
    } else {
      // Fallback to API if no session could be resolved (shouldn’t happen in normal usage)
      const { progress } = await fetchProgress(id);
      per = (progress ?? {}) as typeof per;
    }
  } catch {}

  // Safety: if totals are missing (e.g., after reset or blank row), compute from cards
  let cardTotals: Partial<Record<DeckBloomLevel, number>> | null = null;
  try {
    const all = await cardsRepo.listByDeck(id);
    const map: Partial<Record<DeckBloomLevel, number>> = {};
    all.forEach((c) => {
      const lvl = (c.bloomLevel ?? "Remember") as DeckBloomLevel;
      map[lvl] = (map[lvl] ?? 0) + 1;
    });
    cardTotals = map;
  } catch {}

  // Build levels regardless of fetch outcome so the page always renders rows
  const cap = DEFAULT_QUEST_SETTINGS.missionCap;
  levels = (BLOOM_LEVELS as DeckBloomLevel[]).map((lvl) => {
    const p: BP = (per && per[lvl]) || {};
  const totalCards = Number(p.totalCards ?? 0) || Number(cardTotals?.[lvl] ?? 0);
    const missionsCompleted = Number(p.missionsCompleted ?? 0);
    const totalMissions = Math.ceil(totalCards / cap) || 0;
    const mastered = !!p.mastered;
  const updatedSinceLastRun = Number((per?.[lvl] as (BP & { updatedSinceLastRun?: number }) | undefined)?.updatedSinceLastRun ?? 0);
    return { level: lvl, totalCards, missionsCompleted, totalMissions, mastered, unlocked: false, updatedSinceLastRun };
  });
  // Unlocking rules (single-pass model):
  // - Remember is always unlocked
  // - Level N is unlocked if previous level is mastered or cleared (single pass ≥ threshold recorded)
  const passThreshold = DEFAULT_QUEST_SETTINGS.passThreshold; // fallback only
  for (let i = 0; i < levels.length; i++) {
    if (i === 0) {
      levels[i]!.unlocked = true;
      unlockWhy.push({ level: levels[i]!.level, prevMastered: false, prevCleared: true, prevAvg: 100, prevHasMission: true });
      continue;
    }
    const prevLvl = levels[i - 1]!.level;
    const prev = per?.[prevLvl] as BP | undefined;
    const prevMastered = !!prev?.mastered;
    const prevCleared = !!prev?.cleared;
    // backward-compatible fallback if cleared not present
    let fallbackUnlock = false;
    if (!prevCleared) {
      const prevAvg = prev && (prev.accuracyCount ?? 0) > 0 ? Math.round(((prev.accuracySum ?? 0) / Math.max(1, prev.accuracyCount ?? 0)) * 100) : 0;
      const prevHasMission = (prev?.missionsCompleted ?? 0) > 0;
      fallbackUnlock = prevHasMission && prevAvg >= passThreshold;
      unlockWhy.push({ level: levels[i]!.level, prevMastered, prevCleared, prevAvg, prevHasMission });
    } else {
      const prevAvg = prev && (prev.accuracyCount ?? 0) > 0 ? Math.round(((prev.accuracySum ?? 0) / Math.max(1, prev.accuracyCount ?? 0)) * 100) : 0;
      const prevHasMission = (prev?.missionsCompleted ?? 0) > 0;
      unlockWhy.push({ level: levels[i]!.level, prevMastered, prevCleared, prevAvg, prevHasMission });
    }
    levels[i]!.unlocked = prevMastered || prevCleared || fallbackUnlock;
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quest Missions</h1>
        <a href={`/decks/${id}/study`} className="text-sm text-blue-700 hover:underline">Back to Study</a>
      </div>

      {/* Debug: show why each level is unlocked or locked and the raw per_bloom snapshot */}
      <details className="mb-4 border rounded p-3 bg-slate-50">
        <summary className="cursor-pointer text-sm text-slate-700">Debug: unlock reasoning + per_bloom</summary>
        <div className="mt-2 text-xs text-slate-700">
          <div className="mb-2">Unlock checks use: previous.mastered OR previous.cleared (single pass ≥ {DEFAULT_QUEST_SETTINGS.passThreshold}%) OR (prev missions ≥ 1 AND prev average ≥ {DEFAULT_QUEST_SETTINGS.passThreshold}%).</div>
          <div className="mb-2 whitespace-pre-wrap">{JSON.stringify({ levels: levels.map((l) => ({ level: l.level, unlocked: l.unlocked, missionsCompleted: l.missionsCompleted, totalMissions: l.totalMissions })), unlockWhy }, null, 2)}</div>
          <div className="whitespace-pre-wrap">{JSON.stringify(per ?? {}, null, 2)}</div>
        </div>
      </details>

      <div className="space-y-3">
        {levels.map((li, idx) => {
          const color = BLOOM_COLOR_HEX[li.level] || "#e2e8f0";
          const isStarted = li.missionsCompleted > 0 && li.missionsCompleted < li.totalMissions;
          const isCompleted = li.totalMissions > 0 && li.missionsCompleted >= li.totalMissions;
          const multi = li.totalMissions > 1;
          const nextUnlocked = levels[idx + 1]?.unlocked ?? false;
          const hasMissions = li.totalMissions > 0;
          const comingSoon = li.level === ("Create" as DeckBloomLevel);
          // Nudge when: user has done ≥1 mission on this level, hasn't mastered it yet,
          // and the next level is still locked (i.e., average < pass threshold and not cleared)
          const shouldNudge = li.unlocked && !nextUnlocked && li.missionsCompleted > 0 && !li.mastered;
          return (
            <div key={li.level}>
              <div
                className="w-full flex items-center justify-between rounded-lg border p-4"
                style={{
                  // Light tint of the bloom color for background, readable text foreground
                  backgroundColor: li.unlocked ? `${color}1A` : "#f8fafc", // ~10% opacity
                  borderColor: li.unlocked ? color : "#e2e8f0",
                  opacity: li.unlocked ? 1 : 0.9,
                }}
                aria-disabled={!li.unlocked}
              >
                <div className="text-left">
                  <div className="font-extrabold" style={{ color }}>{li.level}</div>
                  <div className="text-sm text-slate-600">
                    {comingSoon
                      ? "Coming soon"
                      : li.totalMissions === 0
                      ? `0 missions`
                      : isCompleted || li.mastered
                        ? `Completed • ${li.totalMissions} missions`
                        : isStarted
                          ? `${Math.min(li.missionsCompleted, li.totalMissions)} / ${li.totalMissions} completed`
                          : `${li.totalMissions} missions`}
                    {li.updatedSinceLastRun > 0 && (
                      <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs" style={{ background: "#f1f5f9", color: "#0f172a" }}>
                        Updated: +{li.updatedSinceLastRun} new
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
          {li.unlocked ? (
                    <>
            {comingSoon ? (
                        <span className="text-sm font-medium px-3 py-1.5 rounded bg-slate-200 text-slate-600 cursor-not-allowed" aria-disabled>Coming Soon</span>
                      ) : !hasMissions ? (
                        <span className="text-sm font-medium px-3 py-1.5 rounded bg-slate-200 text-slate-600 cursor-not-allowed" aria-disabled>Start</span>
                      ) : isCompleted || li.mastered ? (
                        <a
                          href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}&restart=1`}
                          className="text-sm font-medium px-3 py-1.5 rounded bg-slate-200 text-slate-700"
                        >
              {shouldNudge ? "Try again to increase accuracy" : "Restart"}
                        </a>
                      ) : isStarted ? (
                        <>
                          <a
                            href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}`}
                            className="text-sm font-medium px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Resume
                          </a>
                          <a
                            href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}&restart=1`}
                            className="text-sm font-medium px-3 py-1.5 rounded bg-slate-200 text-slate-700"
                          >
                            Restart
                          </a>
                        </>
                      ) : (
                        <a
                          href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}`}
                          className="text-sm font-medium px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
              {shouldNudge ? "Try again to increase accuracy" : `Start ${li.level}`}
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600" aria-label="Locked">
                      <LockIcon className="text-amber-500" size={18} />
                      <span className="text-sm font-medium">Locked</span>
                    </div>
                  )}
                </div>
              </div>

        {multi && (
                <details className="mt-2 ml-3 border-l pl-4">
                  <summary className="cursor-pointer list-none text-sm text-slate-600 hover:text-slate-800 select-none">
                    Show missions
                  </summary>
                  <div className="mt-2 space-y-2">
                    {Array.from({ length: li.totalMissions }).map((_, idx) => {
                      const ord = idx + 1;
                      const isDone = ord <= li.missionsCompleted;
                      const isNext = ord === li.missionsCompleted + 1;
      const actionable = li.unlocked && (isNext || isDone) && hasMissions && !comingSoon;
                      return (
                        <div key={ord} className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium">Mission {ord}</span>
                            <span className="text-slate-500"> • {isDone ? "Completed" : isNext ? "Available" : "Locked"}</span>
                          </div>
                          <a
                            href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}`}
                            className={`text-sm font-medium px-3 py-1.5 rounded ${actionable ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-200 text-slate-600 cursor-not-allowed"}`}
                            aria-disabled={!actionable}
                            onClick={(e) => { if (!actionable) e.preventDefault(); }}
                          >
            {isDone ? `Restart` : isNext ? `Start` : "Locked"}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
