"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import type { DeckBloomLevel, DeckCard } from "@/types/deck-cards";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";
import * as cardsRepo from "@/lib/cardsRepo";
import { getSupabaseClient } from "@/lib/supabase/browserClient";
import { computeWeightedAvg } from "@/lib/quest/engine";

type PerBloom = Partial<Record<DeckBloomLevel, { totalCards?: number; missionsCompleted?: number; mastered?: boolean; accuracySum?: number; accuracyCount?: number; totalMissions?: number; cleared?: boolean; weightedAvg?: number; recentAttempts?: Array<{ percent: number; at: string }> }>>;

export default function QuestDebugPage() {
  const params = useParams() as { deckId?: string } | null;
  const deckId = params?.deckId ? Number(params.deckId) : NaN;
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [perBloom, setPerBloom] = useState<PerBloom>({});
  type XpJson = { bloomXp?: Record<string, number>; commanderXp?: Record<string, number>; commanderXpTotal?: number; commanderGranted?: Record<string, boolean> } | null;
  type EventRow = { event_type?: string; bloom_level?: string; payload?: unknown; created_at?: string };
  const [xp, setXp] = useState<XpJson>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [deckTitle, setDeckTitle] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [attemptsByLevel, setAttemptsByLevel] = useState<Partial<Record<DeckBloomLevel, Array<{ percent: number; at: string }>>>>({});
  const [attemptScaleNote, setAttemptScaleNote] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(deckId)) return;
    (async () => {
      try {
        const [cardsRes, progressJson, eventsJson, deckJson] = await Promise.all([
          cardsRepo.listByDeck(deckId),
          fetch(`/api/quest/${deckId}/progress`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/quest/${deckId}/xp-events`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetchDeck(deckId).catch(() => null),
        ]);
        setCards(cardsRes);
        setPerBloom((progressJson?.per_bloom ?? {}) as PerBloom);
        setXp(progressJson?.xp ?? {});
  setEvents(((eventsJson?.events ?? []) as unknown[]).map((e) => (e as EventRow)));
        setDeckTitle(deckJson?.title ? String(deckJson.title) : `Deck #${deckId}`);

        // Fetch recent mission attempts to explain averages
        try {
          const supabase = getSupabaseClient();
          const { data: userData } = await supabase.auth.getUser();
          const uid = userData?.user?.id;
          if (!uid) throw new Error("not signed in");
          const { data: rows } = await supabase
            .from("user_deck_mission_attempts")
            .select("bloom_level, score_pct, ended_at, created_at, user_id")
            .eq("deck_id", deckId)
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(200);
          const grouped: Partial<Record<DeckBloomLevel, Array<{ percent: number; at: string }>>> = {};
          let sawFractional = false;
          for (const r of (rows ?? []) as Array<{ bloom_level: DeckBloomLevel; score_pct: number; ended_at: string }>) {
            const lvl = (r.bloom_level ?? "Remember") as DeckBloomLevel;
            if (!grouped[lvl]) grouped[lvl] = [];
            let val = Number(r.score_pct ?? 0);
            // Normalize possible historical 0..1 scores to 0..100
            if (val > 0 && val <= 1) { val = val * 100; sawFractional = true; }
            grouped[lvl]!.push({ percent: Math.round(val), at: r.ended_at });
          }
          setAttemptsByLevel(grouped);
          setAttemptScaleNote(sawFractional ? "Detected fractional scores in attempts; normalized to % (x100)." : null);
        } catch {
          // ignore fetch attempts failure
        }
      } catch {}
    })();
  }, [deckId]);

  const byLevel = useMemo(() => {
    const cap = DEFAULT_QUEST_SETTINGS.missionCap;
    const result = BLOOM_LEVELS.map((lvl) => {
      const p = perBloom?.[lvl as DeckBloomLevel] || {};
      const totalCardsStored = Number(p.totalCards ?? 0);
      const missionsCompleted = Number(p.missionsCompleted ?? 0);
  const mastered = !!p.mastered;
  const cleared = !!p.cleared;
      const accuracySum = Number(p.accuracySum ?? 0);
      const accuracyCount = Number(p.accuracyCount ?? 0);
      const avgPercent = accuracyCount > 0 ? Math.round((accuracySum / Math.max(1, accuracyCount)) * 100) : 0;
  const weightedAvg = Number(p.weightedAvg ?? avgPercent);
      // compute from cards
      const countFromCards = (cards ?? []).filter((c) => (c.bloomLevel ?? "Remember") === (lvl as DeckBloomLevel)).length;
      const totalMissionsCalc = Math.ceil(countFromCards / cap) || 0;
  const totalMissionsStored = Number((p.totalMissions ?? Math.ceil(totalCardsStored / cap)) || 0);
  const isCompleted = totalMissionsStored > 0 && missionsCompleted >= totalMissionsStored;
      // unlock check using same logic as enter page
      const idx = BLOOM_LEVELS.indexOf(lvl as DeckBloomLevel);
      let unlocked = idx === 0; // Remember always
      if (idx > 0) {
        const prevLvl = BLOOM_LEVELS[idx - 1] as DeckBloomLevel;
        const prev = perBloom?.[prevLvl] || {};
  const prevAvg = (Number(prev.accuracyCount ?? 0) > 0) ? Math.round((Number(prev.accuracySum ?? 0) / Math.max(1, Number(prev.accuracyCount ?? 0))) * 100) : 0;
  const prevCleared = !!prev.cleared;
  const prevMastered = !!prev.mastered;
  const prevHasMission = Number(prev.missionsCompleted ?? 0) > 0;
  unlocked = prevMastered || prevCleared || (prevHasMission && prevAvg >= DEFAULT_QUEST_SETTINGS.passThreshold);
      }
      // derive UI state per spec
      let buttonState: "Locked" | "Start" | "Resume+Restart" | "Restart" = "Locked";
      if (unlocked) {
        if (mastered || isCompleted) buttonState = "Restart";
        else if (missionsCompleted > 0 && missionsCompleted < totalMissionsStored) buttonState = "Resume+Restart";
        else buttonState = "Start";
      }
      return {
        level: lvl as DeckBloomLevel,
        totalCardsStored,
        totalCardsFromDeck: countFromCards,
        totalMissionsStored,
        totalMissionsCalc,
        missionsCompleted,
  mastered,
  avgPercent,
  cleared,
  weightedAvg,
        unlocked,
        buttonState,
      };
    });
    return result;
  }, [perBloom, cards]);

  const mismatches = useMemo(() => byLevel.filter((r) => r.totalCardsStored !== r.totalCardsFromDeck || r.totalMissionsStored !== r.totalMissionsCalc), [byLevel]);

  async function reconcileTotals() {
    if (!Number.isFinite(deckId)) return;
    setBusy(true);
    try {
      const cap = DEFAULT_QUEST_SETTINGS.missionCap;
      const updated: PerBloom = { ...(perBloom ?? {}) };
      BLOOM_LEVELS.forEach((lvl) => {
        const cnt = (cards ?? []).filter((c) => (c.bloomLevel ?? "Remember") === (lvl as DeckBloomLevel)).length;
        const pb = updated[lvl as DeckBloomLevel] || {};
        pb.totalCards = cnt;
        pb.totalMissions = Math.ceil(cnt / cap) || 0;
        updated[lvl as DeckBloomLevel] = pb;
      });
      await fetch(`/api/quest/${deckId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ per_bloom: updated, xp }) });
      setPerBloom(updated);
    } finally {
      setBusy(false);
    }
  }

  async function resetAll() {
    if (!Number.isFinite(deckId)) return;
    setBusy(true);
    try {
      await fetch(`/api/quest/${deckId}/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wipeXp: true }) });
      // reload
      const progressJson = await fetch(`/api/quest/${deckId}/progress`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      setPerBloom((progressJson?.per_bloom ?? {}) as PerBloom);
      setXp(progressJson?.xp ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Quest Debug · Deck {Number.isFinite(deckId) ? deckId : "?"}</h1>
      <p className="text-sm text-slate-600 mb-4">{deckTitle}</p>

      <div className="flex gap-2 mb-4">
        <button className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" onClick={reconcileTotals} disabled={busy}>Reconcile totals from cards</button>
        <button className="px-3 py-2 rounded bg-amber-600 text-white disabled:opacity-50" onClick={resetAll} disabled={busy}>Reset all quest data (danger)</button>
        <a className="px-3 py-2 rounded bg-slate-200" href={`/decks/${deckId}/quest/enter`} target="_blank">Open Quest Enter</a>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Per-level state</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Level</th>
                <th className="p-2">Cards (stored)</th>
                <th className="p-2">Cards (from deck)</th>
                <th className="p-2">Missions (stored)</th>
                <th className="p-2">Missions (calc)</th>
                <th className="p-2">Missions Completed</th>
                <th className="p-2">Avg % (stored)</th>
                <th className="p-2">Avg % (from attempts)</th>
                <th className="p-2">WAvg % (from attempts)</th>
                <th className="p-2">Mastered</th>
                <th className="p-2">Cleared</th>
                <th className="p-2">Unlocked</th>
                <th className="p-2">Button</th>
                <th className="p-2">Why locked/unlocked</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {byLevel.map((r) => {
                const idx = BLOOM_LEVELS.indexOf(r.level);
                const prev = idx > 0 ? perBloom?.[BLOOM_LEVELS[idx - 1] as DeckBloomLevel] || {} : {};
                const prevAvg = (Number(prev.accuracyCount ?? 0) > 0) ? Math.round((Number(prev.accuracySum ?? 0) / Math.max(1, Number(prev.accuracyCount ?? 0))) * 100) : 0;
                const prevHasMission = Number(prev.missionsCompleted ?? 0) > 0;
                const attempts = attemptsByLevel[r.level] ?? [];
                const avgFromAttempts = attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.percent, 0) / attempts.length) : 0;
                const wavgFromAttempts = computeWeightedAvg(attempts.map((a) => ({ percent: a.percent }))); // weights newer higher
                return (
                  <tr key={r.level} className="border-b">
                    <td className="p-2 font-medium">{r.level}</td>
                    <td className="p-2">{r.totalCardsStored}</td>
                    <td className="p-2">{r.totalCardsFromDeck}</td>
                    <td className="p-2">{r.totalMissionsStored}</td>
                    <td className="p-2">{r.totalMissionsCalc}</td>
                    <td className="p-2">{r.missionsCompleted}</td>
                    <td className="p-2">{r.avgPercent}%</td>
                    <td className="p-2">{avgFromAttempts}%</td>
                    <td className="p-2">{wavgFromAttempts}%</td>
                    <td className="p-2">{r.mastered ? "true" : "false"}</td>
                    <td className="p-2">{r.cleared ? "true" : "false"}</td>
                    <td className="p-2">{r.unlocked ? "true" : "false"}</td>
                    <td className="p-2">{r.buttonState}</td>
                    <td className="p-2 text-xs text-slate-600">
                      {idx === 0 ? "Remember is always unlocked" : (
                        <>
                          prev mastered: {prev?.mastered ? "true" : "false"}; prev cleared: {prev?.cleared ? "true" : "false"}; fallback avg ≥ {DEFAULT_QUEST_SETTINGS.passThreshold}: {prevAvg >= DEFAULT_QUEST_SETTINGS.passThreshold ? "true" : "false"}; prev has mission: {prevHasMission ? "true" : "false"}
                        </>
                      )}
                    </td>
                    <td className="p-2">
                      <a className="text-blue-700 underline" href={`/decks/${deckId}/quest?level=${encodeURIComponent(r.level)}${(r.missionsCompleted >= r.totalMissionsStored || r.mastered) ? "&restart=1" : ""}`} target="_blank" rel="noreferrer">Open Mission</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {mismatches.length > 0 && (
          <div className="mt-2 text-amber-700 text-sm">Detected {mismatches.length} mismatch(es) between stored totals and deck cards. Use &quot;Reconcile totals from cards&quot;.</div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Attempt history and averages (why your average looks this way)</h2>
        {attemptScaleNote && (
          <div className="mb-2 text-xs text-amber-700">{attemptScaleNote}</div>
        )}
        <div className="space-y-3 text-sm">
          {(BLOOM_LEVELS as DeckBloomLevel[]).map((lvl) => {
            const attempts = attemptsByLevel[lvl] ?? [];
            if (attempts.length === 0) return (
              <div key={lvl} className="text-slate-500">{lvl}: no attempts recorded yet.</div>
            );
            const unweighted = Math.round(attempts.reduce((s, a) => s + a.percent, 0) / attempts.length);
            const weighted = computeWeightedAvg(attempts.map((a) => ({ percent: a.percent })));
            return (
              <div key={lvl} className="border rounded p-3 bg-slate-50">
                <div className="font-medium mb-1">{lvl}</div>
                <div className="text-slate-700">Attempts (newest → oldest): {attempts.map((a) => `${a.percent}%`).join(", ")}</div>
                <div className="text-slate-700">Unweighted average: {unweighted}% · Weighted recent average: {weighted}%</div>
                <div className="text-xs text-slate-600 mt-1">
                  Notes: Unweighted average treats all missions equally. Weighted average gives more weight to recent missions. Next-level unlock uses: at least one mission AND unweighted average ≥ {DEFAULT_QUEST_SETTINGS.passThreshold}% (unless the previous level is marked cleared/mastered by a single pass). If you aced the last mission but earlier scores were low, the unweighted average may still be below the threshold.
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Latest events (for windowing)</h2>
        <div className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded border">
          {JSON.stringify(events, null, 2)}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Raw per_bloom</h2>
        <div className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded border">
          {JSON.stringify(perBloom, null, 2)}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-2">XP ledger</h2>
        <div className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded border">
          {JSON.stringify(xp, null, 2)}
        </div>
      </section>
    </main>
  );
}

async function fetchDeck(deckId: number): Promise<{ title?: string } | null> {
  try {
    const supabase = (await import("@/lib/supabase/browserClient")).getSupabaseClient();
    const { data, error } = await supabase.from("decks").select("title").eq("id", deckId).maybeSingle();
    if (error) return null;
  return { title: (data?.title ? String(data.title) : undefined) };
  } catch {
    return null;
  }
}
