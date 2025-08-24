"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckBloomLevel, DeckCard } from "@/types/deck-cards";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { startMission, recordAnswer, computePass, composeMission, computeMissionSet } from "@/lib/quest/engine";
import type { MissionState, UserBloomProgress } from "@/lib/quest/types";
import { QuestProgress } from "@/components/QuestProgress";
// Centered study view: no Agent sidebar, but show a small header and progress
import QuestStudyCard from "@/components/study/QuestStudyCard";
import { fetchProgress, saveProgressRepo, fetchMission, upsertMission, fetchSrs, logXpEvent } from "@/lib/quest/repo";
import { Bloom } from "@/lib/bloom";
import { useMasteryTracker } from "@/lib/useMasteryTracker";
// no auth header/sidebar needs

export default function QuestClient({ deckId }: { deckId: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [progress, setProgress] = useState<UserBloomProgress | null>(null);
  const [mission, setMission] = useState<MissionState | null>(null);
  const [level, setLevel] = useState<DeckBloomLevel>(() => {
    const initial = (sp?.get("level") ?? "") as DeckBloomLevel;
    return (BLOOM_LEVELS as DeckBloomLevel[]).includes(initial) ? initial : ("Remember" as DeckBloomLevel);
  });

  const tracker = useMasteryTracker();
  const startedIsoRef = useRef<string | null>(null);
  const pendingRef = useRef<{ cardId: number; correct: boolean | number; payload?: Record<string, unknown>; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean; cardType?: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  // Centered study page does not show header/sidebar; omit user/deck state.

  // Load deck cards
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await cardsRepo.listByDeck(deckId);
      if (!alive) return;
      setCards(list);
    })();
    return () => { alive = false; };
  }, [deckId]);

  // Load progress + SRS and prefer first non-mastered level if level not specified explicitly
  useEffect(() => {
    let alive = true;
    (async () => {
  const { progress } = await fetchProgress(deckId);
      if (!alive) return;
      setProgress(progress);
      // If URL did not specify level, pick the earliest tier with remaining missions
      if (!(sp?.get("level") ?? "")) {
        const order = BLOOM_LEVELS as DeckBloomLevel[];
        const next = order.find((lvl) => {
          const p = (progress ?? ({} as UserBloomProgress))[lvl as DeckBloomLevel];
          if (!p) return false;
          const remaining = Math.max(0, (p.totalMissions ?? 0) - (p.missionsCompleted ?? 0));
          return remaining > 0 && !p.mastered && !p.cleared;
        }) as DeckBloomLevel | undefined;
        if (next) setLevel(next);
      }
    })();
    return () => { alive = false; };
  }, [deckId, sp]);

  // Fetch existing mission or compose a new one
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!cards || !level) return;
      // Try resume existing mission from server
      const mi = Math.max(0, (progress?.[level]?.missionsCompleted ?? 0));
      const existing = await fetchMission(deckId, level, mi).catch(() => null);
      if (!alive) return;
      if (existing && existing.cardOrder.length > 0) {
        setMission(existing);
        startedIsoRef.current = existing.startedAt;
        return;
      }
      // Compose a new mission
      const srs = await fetchSrs(deckId).catch(() => ({}));
  const comp = composeMission({ deckId, level, allCards: cards, missionIndex: mi, srs });
      // Fallback: if this level has no cards for a mission, try another level that has cards
      if (!comp.missionIds || comp.missionIds.length === 0) {
        const levels = BLOOM_LEVELS as DeckBloomLevel[];
        const alt = levels.find((lvl) => {
          const sets = computeMissionSet({ deckId, level: lvl, allCards: cards, missionIndex: 0, srs });
          return sets.cards.length > 0;
        });
        if (alt && alt !== level) {
          setLevel(alt);
          return;
        }
      }
      const state = startMission({ deckId, level, missionIndex: mi, poolIds: comp.missionIds, seed: comp.seedUsed });
      setMission(state);
      startedIsoRef.current = state.startedAt;
      await upsertMission(deckId, state);
      await logXpEvent(deckId, level, "mission_started", { missionIndex: mi, total: state.cardOrder.length });
    })();
    return () => { alive = false; };
  }, [cards, level, progress, deckId]);

  const currentCard: DeckCard | null = useMemo(() => {
    if (!mission || !cards) return null;
    const idx = mission.answered.length;
    const id = mission.cardOrder[idx];
    if (typeof id === "undefined") return null;
    return cards.find((c) => c.id === id) ?? null;
  }, [mission, cards]);

  async function applyPendingAndAdvance() {
    if (!mission || !pendingRef.current) return;
    const p = pendingRef.current;
    pendingRef.current = null;

    // Update mission state with recorded answer
    const next = recordAnswer(mission, p.cardId, p.correct);
    setMission(next);
    await upsertMission(deckId, next);

    // Track mastery immediately
    const bloomEnum = Bloom[mission.bloomLevel as keyof typeof Bloom];
    const val = typeof p.correct === "number" ? p.correct : (p.correct ? 1 : 0);
    try {
      await tracker({ cardId: p.cardId, bloom: bloomEnum, correctness: val, correct: typeof p.correct === "boolean" ? p.correct : undefined, responseMs: p.responseMs, confidence: p.confidence, guessed: p.guessed, cardType: p.cardType });
    } catch {}

    // If finished, finalize and redirect
    if (next.answered.length >= next.cardOrder.length && next.cardOrder.length > 0) {
  setFinishing(true);
      const { total, correct, percent } = computePass(next);
      const q = new URLSearchParams();
      q.set("level", next.bloomLevel);
      q.set("pct", String(percent));
      q.set("total", String(total));
      q.set("correct", String(Math.round(correct)));
      // Fire-and-forget economy finalize
      try {
        void fetch(`/api/economy/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deckId, mode: "quest", correct: Math.round(correct), total, percent }),
        }).catch(() => {});
      } catch {}
      // Record attempt row for history/progression
      try {
        const resp = await fetch(`/api/quest/${deckId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "quest",
            bloom_level: next.bloomLevel,
            score_pct: percent,
            cards_seen: total,
            cards_correct: Math.round(correct),
            started_at: startedIsoRef.current ?? next.startedAt,
            ended_at: new Date().toISOString(),
          }),
        });
        if (resp.ok) {
          const j = await resp.json().catch(() => null);
          if (j && typeof j.unlocked !== "undefined") q.set("unlocked", j.unlocked ? "1" : "0");
        }
      } catch {}
      // Persist progress snapshot too (non-blocking)
      try { await saveProgressRepo(deckId, progress ?? undefined, undefined); } catch {}
      router.replace(`/decks/${deckId}/mission-complete?${q.toString()}`);
      return;
    }
  }

  function onAnswer(ev: { cardId: number; correct?: boolean; correctness?: number; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean; payload?: Record<string, unknown>; cardType: string }) {
    const val = typeof ev.correctness === "number"
      ? Math.max(0, Math.min(1, ev.correctness))
      : (typeof ev.correct === "boolean" ? ev.correct : false);
    pendingRef.current = { cardId: ev.cardId, correct: val as boolean | number, payload: ev.payload, responseMs: ev.responseMs, confidence: ev.confidence, guessed: ev.guessed, cardType: ev.cardType };
  }

  // No header/progress; render only the centered card content.

  const total = mission?.cardOrder.length ?? 0;
  const currentIndex = mission?.answered.length ?? 0;

  return (
    <main className="study-page relative min-h-screen overflow-hidden">
      {/* Header: mode title + small progress spanning page width */}
      <div className="absolute top-0 left-0 right-0 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-sm font-semibold text-slate-900">Quest Mode · {level}{mission ? ` · Mission ${mission.missionIndex + 1}` : ""}</div>
          {mission ? (
            <div className="mt-1">
              <QuestProgress current={currentIndex} total={total} color="#3b82f6" label={`${Math.min(total, currentIndex + 1)}/${total}`} />
            </div>
          ) : null}
        </div>
      </div>
  <div className="absolute left-0 right-0 bottom-0 top-20 md:top-24 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-lg shadow p-6 max-h-[78vh] overflow-y-auto">
            {finishing ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" aria-label="Loading" />
              </div>
            ) : mission ? (
              total > 0 && currentCard ? (
                <QuestStudyCard card={currentCard} onAnswer={onAnswer} onContinue={applyPendingAndAdvance} />
              ) : (
                <div className="rounded-xl border bg-slate-50 p-6 text-slate-700">
                  <div className="text-lg font-semibold mb-1">No cards available</div>
                  <p className="text-sm">This Bloom level has no cards for a mission yet. Try another level or add cards.</p>
                </div>
              )
            ) : (
              <div className="rounded-xl border bg-slate-50 p-6 text-slate-700">
                <div className="text-lg font-semibold mb-1">Setting up…</div>
                <p className="text-sm">Composing your mission and loading cards.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
