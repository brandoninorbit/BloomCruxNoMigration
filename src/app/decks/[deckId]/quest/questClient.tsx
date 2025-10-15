"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckBloomLevel, DeckCard } from "@/types/deck-cards";
import { BLOOM_LEVELS, BLOOM_COLOR_HEX } from "@/types/card-catalog";
import { startMission, recordAnswer, computePass, composeMission, computeMissionSet } from "@/lib/quest/engine";
import type { MissionState, UserBloomProgress, SRSPerformance } from "@/lib/quest/types";
import { QuestProgress } from "@/components/QuestProgress";
// Centered study view: no Agent sidebar, but show a small header and progress
import QuestStudyCard from "@/components/study/QuestStudyCard";
import { fetchProgress, saveProgressRepo, fetchMission, upsertMission, fetchSrs, logXpEvent, upsertSrs } from "@/lib/quest/repo";
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
  // Cache SRS for this deck so we can persist attempts on mission completion
  const srsRef = useRef<SRSPerformance>({});
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
          const p = (progress ?? ({} as UserBloomProgress))[lvl as DeckBloomLevel] as (UserBloomProgress[DeckBloomLevel] & { missionsPassed?: number }) | undefined;
          if (!p) return false;
          const remaining = Math.max(0, (p.totalMissions ?? 0) - (Number(p.missionsPassed ?? p.missionsCompleted ?? 0)));
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
      
      // Check if this is a restart request
      const isRestart = sp?.get("restart") === "1";
      
      // Try resume existing mission from server (unless restarting)
      if (!isRestart) {
        // Mission gating: index is number of PASSED missions, not just completed attempts
        const mi = Math.max(0, (progress?.[level]?.missionsPassed ?? progress?.[level]?.missionsCompleted ?? 0));
        const existing = await fetchMission(deckId, level, mi).catch(() => null);
        if (!alive) return;
        if (existing && existing.cardOrder.length > 0) {
          // Reconcile mission with current deck cards (skip deleted cards)
          const available = new Set((cards ?? []).map(c => c.id));
          const filteredOrder = existing.cardOrder.filter(id => available.has(id));
          // Keep only answered entries that still exist and are in the filtered order
          const orderSet = new Set(filteredOrder);
          const filteredAnswered = (existing.answered ?? []).filter(a => orderSet.has(a.cardId));
          const recomputeCorrect = filteredAnswered.reduce((s, a) => s + (typeof a.correct === "number" ? Math.max(0, Math.min(1, a.correct)) : (a.correct ? 1 : 0)), 0);

          if (filteredOrder.length === 0) {
            // All cards for this mission are gone; fall through to compose a fresh mission
          } else {
            const normalized = (filteredOrder.length !== existing.cardOrder.length || filteredAnswered.length !== existing.answered.length)
              ? { ...existing, cardOrder: filteredOrder, answered: filteredAnswered, correctCount: recomputeCorrect, resumedAt: new Date().toISOString() }
              : existing;
            // If normalized is already complete after filtering, do not resume; compose new mission instead
            if (normalized.answered.length < normalized.cardOrder.length) {
              setMission(normalized);
              startedIsoRef.current = normalized.startedAt;
              // Persist normalization to server for idempotent resume
              try { await upsertMission(deckId, normalized); } catch {}
              return;
            }
            // else: fall through to compose new mission
          }
        }
      }
      
      // Compose a new mission (either no existing mission or restart requested)
  const srs = await fetchSrs(deckId).catch(() => ({}));
  srsRef.current = srs;
  // For fresh composition, also use missionsPassed as the mission index
  const mi = Math.max(0, (progress?.[level]?.missionsPassed ?? progress?.[level]?.missionsCompleted ?? 0));
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
        // No more missions available for this level and no alternative level found
        // Check if this level is completed
        const levelProgress = progress?.[level];
        if (levelProgress && levelProgress.totalMissions && levelProgress.missionsCompleted >= levelProgress.totalMissions) {
          // Level is completed, show completion message
          setMission(null); // This will trigger the "No cards available" message, but we should make it more specific
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
  }, [cards, level, progress, deckId, sp]);

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
  const next = recordAnswer(mission, p.cardId, p.correct, p.payload);
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
      // Mark mission as completed
      const completedMission = { ...next, completedAt: new Date().toISOString() };
      await upsertMission(deckId, completedMission);
  setFinishing(true);
      const { total, correct, percent } = computePass(next);
      const q = new URLSearchParams();
      q.set("level", next.bloomLevel);
      q.set("pct", String(percent));
      q.set("total", String(total));
      q.set("correct", String(Math.round(correct)));
      // Finalize with per-bloom breakdown and capture deltas if available
      try {
        // Compute per-bloom breakdown for finalize
        const breakdown: Record<string, { correct: number; total: number }> = {};
        if (cards) {
          const perBloom: Record<string, { seen: number; correct: number }> = {};
          next.answered.forEach((ans) => {
            const card = cards.find((c) => c.id === ans.cardId);
            if (card) {
              const bloom = card.bloomLevel || "Remember";
              const prev = perBloom[bloom] || { seen: 0, correct: 0 };
              prev.seen += 1;
              prev.correct += (typeof ans.correct === "number" ? ans.correct : (ans.correct ? 1 : 0));
              perBloom[bloom] = prev;
            }
          });
          Object.keys(perBloom).forEach((bloom) => {
            const { seen, correct } = perBloom[bloom]!;
            if (seen > 0) {
              breakdown[bloom] = { correct: Math.round(correct), total: seen };
            }
          });
        }
        const resp = await fetch(`/api/economy/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deckId, mode: "quest", correct: Math.round(correct), total, percent, breakdown }),
        }).catch(() => null);
        if (resp && resp.ok) {
          // response contains xpDelta/tokensDelta, but mission-complete now fetches last finalize itself
          await resp.json().catch(() => null);
        }
      } catch {}
      // Record attempt row for history/progression
      // First, persist per-card SRS attempts so retention/coverage have data
      try {
        const changed: SRSPerformance = {};
        const nowIso = new Date().toISOString();
        next.answered.forEach((ans) => {
          const base = srsRef.current[ans.cardId] ?? { attempts: 0, correct: 0 };
          const incAttempts = 1;
          const incCorrect = typeof ans.correct === "number"
            ? Math.max(0, Math.min(1, ans.correct))
            : (ans.correct ? 1 : 0);
          changed[ans.cardId] = {
            attempts: (base.attempts ?? 0) + incAttempts,
            correct: (base.correct ?? 0) + incCorrect,
            lastSeenAt: nowIso,
          };
        });
        if (Object.keys(changed).length > 0) {
          await upsertSrs(deckId, changed);
          srsRef.current = { ...srsRef.current, ...changed };
        }
      } catch {}

      // Record attempt row for history/progression
      try {
        // Compute per-bloom breakdown
        const breakdown: Record<string, { scorePct: number; cardsSeen: number; cardsCorrect: number }> = {};
        if (cards) {
          const perBloom: Record<string, { seen: number; correct: number }> = {};
          next.answered.forEach((ans) => {
            const card = cards.find((c) => c.id === ans.cardId);
            if (card) {
              const bloom = card.bloomLevel || "Remember";
              const prev = perBloom[bloom] || { seen: 0, correct: 0 };
              prev.seen += 1;
              prev.correct += (typeof ans.correct === "number" ? ans.correct : (ans.correct ? 1 : 0));
              perBloom[bloom] = prev;
            }
          });
          Object.keys(perBloom).forEach((bloom) => {
            const { seen, correct } = perBloom[bloom]!;
            if (seen > 0) {
              const pct = (correct / seen) * 100;
              breakdown[bloom] = { scorePct: Math.round(pct * 10) / 10, cardsSeen: seen, cardsCorrect: correct };
            }
          });
        }
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
            breakdown,
            // Persist per-card answers so mission-complete accuracy modal can show details
            answers: next.answered.map(a => ({ cardId: a.cardId, correct: a.correct, response: a.response })),
          }),
        });
        console.log('🎯 Mission complete API call:', {
          status: resp.status,
          url: `/api/quest/${deckId}/complete`,
          payload: {
            mode: "quest",
            bloom_level: next.bloomLevel,
            score_pct: percent,
            cards_seen: total,
            cards_correct: Math.round(correct),
            answersCount: next.answered.length
          }
        });
        if (resp.ok) {
          const j = await resp.json().catch(() => null);
          console.log('✅ Mission complete response:', j);
          if (j && typeof j.unlocked !== "undefined") q.set("unlocked", j.unlocked ? "1" : "0");
        } else {
          const errorText = await resp.text().catch(() => 'Failed to read error');
          console.error('❌ Mission complete failed:', resp.status, resp.statusText, errorText);
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
    <main className="study-page min-h-screen flex flex-col">
      {/* Header: mode title + small progress spanning page width */}
      <div className="p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="text-sm font-semibold text-slate-900">Quest Mode · {level}{mission ? ` · Mission ${mission.missionIndex + 1}` : ""}</div>
          {mission ? (
            <div className="mt-1">
              <QuestProgress
                current={currentIndex}
                total={total}
                color={BLOOM_COLOR_HEX[level] || "#3b82f6"}
                label={`${Math.min(total, currentIndex + 1)}/${total}`}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex-1 flex items-start justify-center p-4">
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
                  {(() => {
                    const levelProgress = progress?.[level];
                    const isLevelCompleted = levelProgress && levelProgress.totalMissions && levelProgress.missionsCompleted >= levelProgress.totalMissions;
                    
                    if (isLevelCompleted) {
                      return (
                        <>
                          <div className="text-lg font-semibold mb-1">🎉 All missions completed!</div>
                          <p className="text-sm mb-4">You&apos;ve completed all missions for the {level} level.</p>
                          <a
                            href={`/decks/${deckId}/quest?level=${encodeURIComponent(level)}&restart=1`}
                            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                          >
                            Restart {level} Missions
                          </a>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <div className="text-lg font-semibold mb-1">No cards available</div>
                          <p className="text-sm">This Bloom level has no cards for a mission yet. Try another level or add cards.</p>
                        </>
                      );
                    }
                  })()}
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
