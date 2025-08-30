"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckBloomLevel, DeckCard, DeckCardType } from "@/types/deck-cards";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { defaultBloomForType, Bloom } from "@/lib/bloom";
import { useMasteryTracker } from "@/lib/useMasteryTracker";
import { fetchSrs, upsertSrs } from "@/lib/quest/repo";
import type { SRSPerformance } from "@/lib/quest/types";
import QuestStudyCard from "@/components/study/QuestStudyCard";
import { QuestProgress } from "@/components/QuestProgress";

const ALL_TYPES: DeckCardType[] = [
  "Standard MCQ",
  "Short Answer",
  "Fill in the Blank",
  "Sorting",
  "Sequencing",
  "Compare/Contrast",
  "Two-Tier MCQ",
  "CER",
];

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function toBloom(b: DeckBloomLevel | undefined, type: DeckCardType): DeckBloomLevel {
  return (b ?? defaultBloomForType(type)) as DeckBloomLevel;
}

export default function RemixClient({ deckId }: { deckId: number }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [order, setOrder] = useState<number[]>([]); // card IDs in play order
  const [idx, setIdx] = useState<number>(0);
  const [done, setDone] = useState<boolean>(false);
  const trackAnswer = useMasteryTracker();
  const srsRef = useRef<SRSPerformance>({});
  const perCardRef = useRef<Record<number, { attempts: number; correct: number }>>({});
  const [correctSum, setCorrectSum] = useState(0);
  const perBloomRef = useRef<Record<DeckBloomLevel, { seen: number; correctFloat: number }>>({ Remember: { seen: 0, correctFloat: 0 }, Understand: { seen: 0, correctFloat: 0 }, Apply: { seen: 0, correctFloat: 0 }, Analyze: { seen: 0, correctFloat: 0 }, Evaluate: { seen: 0, correctFloat: 0 }, Create: { seen: 0, correctFloat: 0 } });
  const startedIsoRef = useRef<string>(new Date().toISOString());
  const [finishing, setFinishing] = useState(false);

  const selectedN = useMemo(() => Math.max(0, Number(sp?.get("n") || 0)), [sp]);
  const selectedLevels = useMemo<DeckBloomLevel[] | null>(() => {
    const v = sp?.get("levels");
    if (!v) return null; // null = all levels
    const vals = v.split(",").map((s) => s.trim()) as DeckBloomLevel[];
    const valid = vals.filter((x) => (BLOOM_LEVELS as DeckBloomLevel[]).includes(x));
    return valid.length ? valid : null;
  }, [sp]);
  const selectedTypes = useMemo<DeckCardType[] | null>(() => {
    const v = sp?.get("types");
    if (!v) return null; // null = all types
    const vals = v.split(",").map((s) => s.trim()) as DeckCardType[];
    const valid = vals.filter((x) => (ALL_TYPES as DeckCardType[]).includes(x));
    return valid.length ? valid : null;
  }, [sp]);

  // Load deck cards
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await cardsRepo.listByDeck(deckId);
      if (!alive) return;
      setCards(list);
  // Load current SRS snapshot for later persistence
  try { srsRef.current = await fetchSrs(deckId).catch(() => ({})); } catch {}
    })();
    return () => { alive = false; };
  }, [deckId]);

  // Compose order based on filters
  useEffect(() => {
    if (!cards) return;
    let pool = cards.filter((c) => {
      const okType = !selectedTypes || selectedTypes.includes(c.type);
      const effBloom = toBloom(c.bloomLevel as DeckBloomLevel | undefined, c.type);
      const okBloom = !selectedLevels || selectedLevels.includes(effBloom);
      return okType && okBloom;
    });
    // Shuffle and cap to N
    pool = shuffleInPlace([...pool]);
    const N = selectedN > 0 ? Math.min(selectedN, pool.length) : pool.length;
    setOrder(pool.slice(0, N).map((c) => c.id));
    setIdx(0);
    setDone(N === 0);
  }, [cards, selectedN, selectedLevels, selectedTypes]);

  const current: DeckCard | null = useMemo(() => {
    if (!cards || idx < 0 || idx >= order.length) return null;
    const id = order[idx]!;
    return cards.find((c) => c.id === id) || null;
  }, [cards, order, idx]);

  function onContinue() {
    const next = idx + 1;
    if (next >= order.length) setDone(true);
    setIdx(next);
  }

  // Wrap tracker to accumulate correctness locally
  function trackLocal(payload: { cardId: number; bloom: Bloom; correctness?: number; correct?: boolean; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean; cardType: string }) {
    try {
      const val = typeof payload.correctness === "number" ? payload.correctness : (typeof payload.correct === "boolean" ? (payload.correct ? 1 : 0) : 0);
      setCorrectSum((s) => s + (Number.isFinite(val) ? val : 0));
  // accumulate per-card for SRS
  const incCorrect = typeof payload.correctness === 'number' ? Math.max(0, Math.min(1, payload.correctness)) : (payload.correct ? 1 : 0);
  const cur = perCardRef.current[payload.cardId] ?? { attempts: 0, correct: 0 };
  perCardRef.current[payload.cardId] = { attempts: cur.attempts + 1, correct: cur.correct + incCorrect };
      // accumulate per-bloom
      const b = Bloom[payload.bloom] as unknown as DeckBloomLevel | undefined;
      const bloomKey = (typeof b === 'string' ? b : undefined) as DeckBloomLevel | undefined;
      if (bloomKey) {
        const map = perBloomRef.current;
        const cur = map[bloomKey] ?? { seen: 0, correctFloat: 0 };
        cur.seen += 1;
        cur.correctFloat += (Number.isFinite(val) ? val : 0);
        map[bloomKey] = cur;
        perBloomRef.current = map;
      }
    } catch {}
    return trackAnswer(payload).catch(() => {});
  }

  // Redirect to mission-complete when done
  useEffect(() => {
    if (!done) return;
  setFinishing(true);
    const total = Math.max(0, order.length);
    const correct = Math.max(0, correctSum);
    const pct = total > 0 ? Math.max(0, Math.min(100, (correct / total) * 100)) : 0;
    // Choose a Bloom level to attribute this Remix session to for progress tracking.
    // If specific levels were selected, take the first; otherwise default to Remember.
    const bloomLevelForComplete: DeckBloomLevel = (selectedLevels && selectedLevels.length > 0 ? selectedLevels[0]! : ("Remember" as DeckBloomLevel));
    const q = new URLSearchParams();
    q.set("mode", "remix");
    q.set("pct", String(Math.round(pct * 10) / 10));
    q.set("total", String(total));
    q.set("correct", String(Math.round(correct)));
    q.set("level", bloomLevelForComplete);
    // Fire-and-forget finalize to mint XP/tokens; do not block UX
    // Also record a mission attempt to update progress/attempts history
    (async () => {
      // Persist SRS per-card attempts before mastery updates
      try {
        const base = srsRef.current;
        const changed: SRSPerformance = {};
        const nowIso = new Date().toISOString();
        Object.entries(perCardRef.current).forEach(([cardIdStr, inc]) => {
          const cardId = Number(cardIdStr);
          const prior = base[cardId] ?? { attempts: 0, correct: 0 };
          changed[cardId] = { attempts: (prior.attempts ?? 0) + (inc?.attempts ?? 0), correct: (prior.correct ?? 0) + (inc?.correct ?? 0), lastSeenAt: nowIso };
        });
        if (Object.keys(changed).length > 0) {
          await upsertSrs(deckId, changed);
          srsRef.current = { ...srsRef.current, ...changed };
        }
      } catch {}
      // Finalize with per-bloom breakdown and capture deltas
      try {
        const map = perBloomRef.current;
        const breakdown: Record<string, { correct: number; total: number }> = {};
        (Object.keys(map) as DeckBloomLevel[]).forEach((lvl) => {
          const seen = Math.max(0, Number(map[lvl]?.seen ?? 0));
          const correctFloat = Math.max(0, Number(map[lvl]?.correctFloat ?? 0));
          if (seen > 0) breakdown[lvl] = { correct: Math.round(correctFloat), total: seen };
        });
        const resp = await fetch(`/api/economy/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deckId, mode: "remix", correct: Math.round(correct), total, percent: Math.round(pct * 10) / 10, breakdown }),
        }).catch(() => null);
  if (resp && resp.ok) { await resp.json().catch(() => null); }
      } catch {}
      try {
        // Build per-bloom breakdown
        const map = perBloomRef.current;
        const breakdown: Record<string, { scorePct: number; cardsSeen: number; cardsCorrect: number }> = {};
        (Object.keys(map) as DeckBloomLevel[]).forEach((lvl) => {
          const seen = Math.max(0, Number(map[lvl]?.seen ?? 0));
          const correctFloat = Math.max(0, Number(map[lvl]?.correctFloat ?? 0));
          if (seen > 0) {
            const pct = Math.max(0, Math.min(100, (correctFloat / seen) * 100));
            breakdown[lvl] = { scorePct: Math.round(pct * 10) / 10, cardsSeen: seen, cardsCorrect: Math.round(correctFloat) };
          }
        });
        const resp = await fetch(`/api/quest/${deckId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "remix",
            bloom_level: bloomLevelForComplete,
            score_pct: Math.round(pct * 10) / 10,
            cards_seen: total,
            cards_correct: Math.round(correct),
            started_at: startedIsoRef.current,
            ended_at: new Date().toISOString(),
            breakdown,
          }),
        });
        if (resp.ok) {
          const j = await resp.json().catch(() => null);
          if (j && typeof j.unlocked !== "undefined") {
            q.set("unlocked", j.unlocked ? "1" : "0");
          }
        }
      } catch {}
  router.replace(`/decks/${deckId}/mission-complete?${q.toString()}`);
    })();
  }, [done, order.length, correctSum, deckId, router, selectedLevels]);
  // Renderers per type (minimal, reuse existing components)
  function renderStudy(c: DeckCard) {
    const effBloom = toBloom(c.bloomLevel as DeckBloomLevel | undefined, c.type);
    const bloomEnum = Bloom[effBloom as keyof typeof Bloom];
    return (
      <QuestStudyCard
        card={c}
        onAnswer={(ev) => {
          const val = typeof ev.correctness === "number" ? ev.correctness : (typeof ev.correct === "boolean" ? (ev.correct ? 1 : 0) : 0);
          trackLocal({ cardId: c.id, bloom: bloomEnum, correctness: val, correct: ev.correct, responseMs: ev.responseMs, confidence: ev.confidence, guessed: ev.guessed, cardType: c.type });
        }}
        onContinue={onContinue}
      />
    );
  }

  // total not shown in the centered view

  return (
    <main className="study-page min-h-screen flex flex-col">
      {/* Header area: mode title + progress */}
      <div className="p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="text-sm font-semibold text-slate-900">Random Remix</div>
          <div className="mt-1">
            <QuestProgress current={idx} total={order.length} color="#334155" label={`${Math.min(order.length, idx + 1)}/${order.length}`} />
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-start justify-center p-4">
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-lg shadow p-6 max-h-[78vh] overflow-y-auto">
            {finishing ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" aria-label="Loading" />
              </div>
            ) : !done && current ? (
              renderStudy(current)
            ) : (
              <div className="rounded-xl border bg-slate-50 p-6 text-slate-700">
                <div className="text-lg font-semibold mb-1">Wrapping up…</div>
                <p className="text-sm">Redirecting to Mission Complete…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
