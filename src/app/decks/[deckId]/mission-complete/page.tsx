"use client";

import React, { useEffect, useMemo, useState } from "react";
import { formatPercent1 } from "@/lib/utils";
import { useParams, useSearchParams } from "next/navigation";
import AgentCard from "@/components/AgentCard";
import { commanderLevel as commanderLevelCalc } from "@/lib/xp";
import { getSupabaseClient } from "@/lib/supabase/browserClient";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";

type MissionSummary = {
  deckId: number | null;
  deckTitle: string;
  modeLabel: string;
  accuracyPercent: number;
  correct?: number;
  total?: number;
  answered: number;
  xpEarned: number;
  tokensEarned: number;
  tokensBalance?: number;
  commanderLevel: number;
  user: { name: string; avatarUrl?: string | null } | null;
  nextHref?: string | null;
  unlocked?: boolean;
  perBloomRaw?: unknown;
};

export default function MissionCompleteProdPage() {
  const params = useParams() as { deckId?: string } | null;
  const sp = useSearchParams();
  const deckId = params?.deckId ? Number(params.deckId) : null;
  const mode = sp?.get("mode");
  const unlocked = sp?.get("unlocked");
  const pct = sp?.get("pct");
  const level = sp?.get("level");

  return (
    <main className="min-h-screen bg-[var(--background-color)] text-[var(--text-primary)] antialiased">
      <div className="relative flex flex-col items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          <LeftAgentCard deckId={deckId} />
          <MissionPanel deckId={deckId} mode={mode ?? null} unlockedParam={unlocked} pctParam={pct} levelParam={level} />
        </div>
      </div>
    </main>
  );
}

function LeftAgentCard({ deckId }: { deckId: number | null }) {
  const [summary, setSummary] = useState<MissionSummary | null>(null);
  useEffect(() => { if (deckId !== null) void loadSummary(deckId, null).then(setSummary); }, [deckId]);
  return (
    <div className="lg:col-span-1 flex justify-center lg:justify-start">
      <div className="w-full h-full">
        <AgentCard
          displayName={summary?.user?.name || "Agent"}
          level={summary?.commanderLevel ?? 1}
          tokens={Math.max(0, Math.round(summary?.tokensBalance ?? 0))}
          avatarUrl={summary?.user?.avatarUrl}
          className="h-full aspect-auto lg:max-w-none"
        />
      </div>
    </div>
  );
}

function MissionPanel({ deckId, mode, unlockedParam, pctParam, levelParam }: { deckId: number | null; mode: string | null; unlockedParam?: string | null; pctParam?: string | null; levelParam?: string | null }) {
  const [summary, setSummary] = useState<MissionSummary | null>(null);
  useEffect(() => { if (deckId !== null) void loadSummary(deckId, mode, { unlockedParam, pctParam, levelParam }).then(setSummary); }, [deckId, mode, unlockedParam, pctParam, levelParam]);
  const stats = useMemo(() => ([
    { k: "XP Earned", v: `+${Math.max(0, Math.round(summary?.xpEarned ?? 0))}`, c: "--hud-blue" },
    { k: "Tokens", v: `+${Math.max(0, Math.round(summary?.tokensEarned ?? 0))}`, c: "--hud-yellow" },
  { k: "Accuracy", v: `${formatPercent1(Number(summary?.accuracyPercent ?? 0))}`, c: "--hud-green" },
  { k: "Correct / Total", v: `${typeof summary?.correct === "number" ? Math.max(0, Math.round(summary.correct)) : "–"} / ${typeof summary?.total === "number" ? Math.max(0, Math.round(summary.total)) : (Number.isFinite(summary?.answered as number) ? Math.max(0, Math.round(summary!.answered)) : "–")}` , c: "--hud-purple" },
  ]), [summary]);

  return (
    <section className="lg:col-span-2 bg-[var(--secondary-color)]/90 backdrop-blur-sm rounded-xl p-6 md:p-8 shadow-sm border border-slate-200 relative h-full">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--primary-color)]">Mission Complete</p>
          <p className="text-[var(--text-secondary)] text-lg">{summary?.modeLabel || "Quest"} — {summary?.deckTitle || "Your Latest Deck"}</p>
        </div>
        <div className="w-full md:w-auto">
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100} aria-label="Mission completion">
            <div className="h-full bg-[var(--primary-color)] rounded-full" style={{ width: "100%" }} />
          </div>
          <p className="text-xs text-center mt-1 text-[var(--text-secondary)]">100% Complete</p>
        </div>
      </header>
      <div className="flex flex-col items-center text-center my-8 md:my-12">
        <div className="relative w-36 h-36 mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--primary-color)]/20 animate-rotate-slow" />
          <div className="absolute inset-2 rounded-full border-2 border-[var(--primary-color)]/30 animate-rotate-slow" style={{ animationDirection: "reverse" }} />
          <div className="w-full h-full flex items-center justify-center animate-pulse-glow rounded-full bg-white">
            <svg className="w-20 h-20 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
        <h1 className="text-4xl font-bold">Agent, mission accomplished.</h1>
        <p className="text-lg text-[var(--text-secondary)] mt-2">You have successfully completed your objective.</p>
      </div>
      {typeof summary?.accuracyPercent === "number" && (
        (() => {
          const pct = Math.max(0, Math.round(summary!.accuracyPercent));
          const pass = summary?.unlocked === true ? true : pct >= DEFAULT_QUEST_SETTINGS.passThreshold;
          const softPass = pass && pct < 75;
          if (softPass) return (
            <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 text-sm">
              Unlocked next Bloom. Strengthen weak spots in <a className="underline" href={deckId !== null ? `/decks/${deckId}/study` : "/decks"}>Target Practice</a> →
            </div>
          );
          if (!pass) return (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 text-red-900 px-4 py-3 text-sm">
              No unlock yet. Try <a className="underline" href={deckId !== null ? `/decks/${deckId}/study` : "/decks"}>Target Practice</a> or Level Up to build retention, then retry.
            </div>
          );
          return null;
        })()
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(({ k, v, c }) => (
          <div key={k} className="rounded-lg p-4 border text-center shadow-sm" style={{ backgroundColor: `color-mix(in srgb, var(${c}), white 90%)`, borderColor: `color-mix(in srgb, var(${c}), transparent 70%)` }}>
            <p className="text-sm font-semibold" style={{ color: `var(${c})` }}>{k}</p>
            <p className="text-2xl font-extrabold" style={{ color: `var(${c})` }}>{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <a
          href="/decks"
          className="bg-white text-[var(--text-primary)] border border-slate-300 rounded-lg px-6 py-3 font-semibold text-center hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-white transition-all duration-200"
        >
          Return to HQ
        </a>
        <a
          href={summary?.nextHref || (deckId !== null ? `/decks/${deckId}/quest` : "/decks")}
          className="bg-[var(--primary-color)] text-white rounded-lg px-6 py-3 font-semibold text-center hover:bg-[var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 focus:ring-offset-white transition-all duration-200 shadow-lg shadow-[var(--primary-color)]/15"
        >
          Start Next Mission
        </a>
      </div>

      {/* Tiny debug echo: server per_bloom snapshot */}
  {(() => { const pb = summary?.perBloomRaw; return Boolean(pb) && typeof pb === "object"; })() && (
        <details className="mt-6">
          <summary className="cursor-pointer text-xs text-slate-600">Debug: per_bloom (server snapshot)</summary>
          <pre className="mt-2 text-[10px] leading-tight p-2 bg-slate-50 border rounded overflow-auto max-h-64 text-slate-700">
    {JSON.stringify((summary?.perBloomRaw ?? {}) as Record<string, unknown>, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}

async function loadSummary(deckId: number, modeParam: string | null, hints?: { unlockedParam?: string | null; pctParam?: string | null; levelParam?: string | null }): Promise<MissionSummary> {
  const supabase = getSupabaseClient();
  const [{ data: userData }, { data: eventsRes }, deckResp, progJson, apiSummary] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("user_xp_events")
      .select("id, deck_id, bloom_level, event_type, payload, created_at")
      .eq("deck_id", deckId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("decks").select("title").eq("id", deckId).maybeSingle(),
    fetch(`/api/quest/${deckId}/progress`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`/api/quest/${deckId}/xp-events`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  const user = userData?.user ?? null;
  type XpEvent = { id: number; deck_id: number; bloom_level: string; event_type: string; payload: unknown; created_at: string };
  const events = (eventsRes ?? []) as XpEvent[];

  const completedIdx = events.findIndex((e) => e.event_type === "mission_completed");
  const latestCompleted = completedIdx >= 0 ? events[completedIdx] : null;
  const tail = completedIdx >= 0 ? events.slice(completedIdx + 1) : [];
  const startedAfterIdx = tail.findIndex((e) => e.event_type === "mission_started");
  const started = startedAfterIdx >= 0 ? tail[startedAfterIdx] : null;
  const prevCompletedAfterIdx = tail.findIndex((e) => e.event_type === "mission_completed");
  const prevCompleted = prevCompletedAfterIdx >= 0 ? tail[prevCompletedAfterIdx] : null;

  let xpEarned = 0;
  let accuracyPercent = 0;
  let answered = 0;
  let correctOut: number | undefined = undefined;
  let totalOut: number | undefined = undefined;
  const deckTitle: string = deckResp?.data?.title ? String(deckResp.data.title) : "";

  // Hints are consumed below; no additional placeholders needed
  if (apiSummary?.found) {
    xpEarned = Number(apiSummary.xp_earned ?? 0);
    const total = Number(apiSummary.total ?? 0);
    const correct = Number(apiSummary.correct ?? 0);
    answered = Number.isFinite(total) ? total : 0;
  totalOut = answered;
  correctOut = Number.isFinite(correct) ? correct : 0;
  const pctFloat = total > 0 ? (correct / total) * 100 : 0;
  accuracyPercent = Math.round(pctFloat * 10) / 10;
  } else if (latestCompleted) {
    const endTime = new Date(latestCompleted.created_at).getTime();
    const postWindowMs = 30 * 1000; // include XP events up to 30s after completion
    const startTime = started
      ? new Date(started.created_at).getTime()
      : prevCompleted
      ? new Date(prevCompleted.created_at).getTime()
      : endTime - 6 * 60 * 60 * 1000; // fallback: last 6 hours
    for (const e of events) {
      const t = new Date(e.created_at).getTime();
      // Include XP events slightly after completion; others must be within [start, end]
      const withinWindow = t > startTime && t <= endTime;
      const isXp = e.event_type === "xp_bloom_added" || e.event_type === "xp_commander_added";
      const withinPost = isXp && t > endTime && t <= endTime + postWindowMs;
      if (!withinWindow && !withinPost) continue;
      if (isXp) {
        const payload = (e.payload ?? {}) as Record<string, unknown>;
        const amtRaw = payload["amount"];
        const amt = typeof amtRaw === "number" ? amtRaw : Number(amtRaw ?? 0);
        if (!Number.isNaN(amt)) xpEarned += amt;
      }
    }
    const p = (latestCompleted.payload ?? {}) as Record<string, unknown>;
    const correct = typeof p["correct"] === "number" ? (p["correct"] as number) : Number(p["correct"] ?? 0);
    const total = typeof p["total"] === "number" ? (p["total"] as number) : Number(p["total"] ?? 0);
    answered = Number.isFinite(total) ? total : 0;
    totalOut = answered;
    correctOut = Number.isFinite(correct) ? correct : 0;
    const pctFloat = total > 0 ? (correct / total) * 100 : 0;
    accuracyPercent = Math.round(pctFloat * 10) / 10;
  }

  // Override answered/accuracy from hints if present
  const pctHint = hints?.pctParam ? Number(hints.pctParam) : NaN;
  if (!Number.isNaN(pctHint)) accuracyPercent = Math.max(0, Math.min(100, Math.round(pctHint * 10) / 10));
  // answered hint from query string if present
  const totalHint = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("total")) ?? null;
  const correctHint = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("correct")) ?? null;
  const totalNum = totalHint ? Number(totalHint) : NaN;
  const correctNum = correctHint ? Number(correctHint) : NaN;
  if (!Number.isNaN(totalNum)) answered = Math.max(0, Math.round(totalNum));
  if (!Number.isNaN(totalNum) && !Number.isNaN(correctNum) && totalNum > 0) {
    totalOut = totalNum;
    correctOut = correctNum;
    accuracyPercent = Math.round(((correctNum / totalNum) * 100) * 10) / 10;
  }

  // If caller provided an explicit pct, prefer it
  const pctFromParam = hints?.pctParam ? Number(hints.pctParam) : NaN;
  if (!Number.isNaN(pctFromParam)) accuracyPercent = Math.max(0, Math.min(100, Math.round(pctFromParam * 10) / 10));

  // If we didn't find xp events (new mode or race), fallback XP ~= correct answers for this mission
  if (!(apiSummary?.found) && xpEarned <= 0 && typeof correctOut === "number" && correctOut >= 0) {
    xpEarned = Math.max(0, Math.round(correctOut));
  }

  // Fetch wallet for commander XP + tokens; fall back to quest aggregates
  let walletCommanderXp = 0;
  let walletTokens = 0;
  try {
    const wallet = await fetch(`/api/economy/wallet`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (wallet) {
      walletCommanderXp = Number(wallet.commander_xp ?? 0);
      walletTokens = Number(wallet.tokens ?? 0);
    }
  } catch {}
  const commanderXpTotal = walletCommanderXp || (progJson && typeof progJson.xp?.commanderXpTotal === "number" ? progJson.xp.commanderXpTotal : 0);
  const commanderLevel = commanderLevelCalc(commanderXpTotal).level;
  // tokensEarned shows this-mission tokens; minted at 0.25 per XP
  const tokensEarned = Math.max(0, Math.round(xpEarned * 0.25));

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "Agent";
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) || (user?.user_metadata?.picture as string | undefined) || null;

  let modeLabel = "Quest";
  if (modeParam) modeLabel = modeParam === "topics" ? "Topic Trek" : modeParam === "timed" ? "Timed Drill" : modeParam === "boost" ? "Boost" : modeParam === "remix" ? "Random Remix" : modeParam === "starred" ? "Starred" : "Quest";

  // Compute the next mission href using the same logic as quest enter unlocks
  let nextHref: string | null = null;
  // Determine unlocked from param first, then fallback to per_bloom[level].cleared
  let unlocked: boolean | undefined = undefined;
  try {
    const fromParam = hints?.unlockedParam ? (hints.unlockedParam === "1" || String(hints.unlockedParam).toLowerCase() === "true") : null;
    if (fromParam === true) unlocked = true;
  } catch {}
  try {
  type PB = Partial<Record<DeckBloomLevel, { mastered?: boolean; totalCards?: number; missionsCompleted?: number; accuracySum?: number; accuracyCount?: number; cleared?: boolean }>>;
    const perBloom: PB = progJson && typeof progJson === "object" && (progJson as { per_bloom?: PB }).per_bloom ? (progJson as { per_bloom?: PB }).per_bloom! : {};
    if (unlocked !== true && hints?.levelParam) {
      const lvl = (hints.levelParam as DeckBloomLevel);
      const prev = perBloom[lvl];
      if (prev?.cleared) unlocked = true;
    }
    const cap = DEFAULT_QUEST_SETTINGS.missionCap;
    const passThreshold = DEFAULT_QUEST_SETTINGS.passThreshold;
    const levels = (BLOOM_LEVELS as DeckBloomLevel[]).map((lvl) => {
      const p = perBloom[lvl] || {};
      const totalCards = Number(p.totalCards ?? 0);
      const missionsCompleted = Number(p.missionsCompleted ?? 0);
      const totalMissions = Math.ceil(totalCards / cap) || 0;
      const mastered = !!p.mastered;
      return { level: lvl, totalCards, missionsCompleted, totalMissions, mastered, unlocked: false };
    });
    // unlocks: Remember always; others unlocked if previous mastered OR cleared (fallback: avg accuracy >= threshold with >=1 mission)
    for (let i = 0; i < levels.length; i++) {
      if (i === 0) { levels[i]!.unlocked = true; continue; }
      const prevLvl = levels[i - 1]!.level;
      const prev = perBloom[prevLvl];
      const prevMastered = !!prev?.mastered;
      const prevCleared = !!prev?.cleared;
      let fallbackUnlock = false;
      if (!prevCleared) {
        const prevAvg = prev && (prev.accuracyCount ?? 0) > 0 ? Math.round(((prev.accuracySum ?? 0) / Math.max(1, prev.accuracyCount ?? 0)) * 100) : 0;
        const prevHasMission = (prev?.missionsCompleted ?? 0) > 0;
        fallbackUnlock = prevHasMission && prevAvg >= passThreshold;
      }
      levels[i]!.unlocked = prevMastered || prevCleared || fallbackUnlock;
    }
    // choose next actionable: first unlocked level with remaining missions and has >0 missions
    const candidate = levels.find((li) => li.unlocked && li.totalMissions > 0 && li.missionsCompleted < li.totalMissions)
      // if none, optionally allow restart of the earliest unlocked level with missions
      ?? levels.find((li) => li.unlocked && li.totalMissions > 0);
    if (candidate) {
      const needsRestart = candidate.missionsCompleted >= candidate.totalMissions;
      const qs = needsRestart ? `&restart=1` : ``;
      nextHref = `/decks/${deckId}/quest?level=${encodeURIComponent(candidate.level)}${qs}`;
    }
    else nextHref = `/decks/${deckId}/quest`;
  } catch {
    nextHref = `/decks/${deckId}/quest`;
  }

  return {
    deckId,
    deckTitle,
    modeLabel,
    accuracyPercent,
  correct: correctOut,
  total: totalOut,
    answered,
    xpEarned,
  tokensEarned,
  tokensBalance: walletTokens,
    commanderLevel,
  user: user ? { name: displayName, avatarUrl } : null,
  nextHref,
  unlocked,
  perBloomRaw: progJson?.per_bloom ?? {},
  };
}
