"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckCard, DeckBloomLevel, DeckCardType } from "@/types/deck-cards";
import { useMasteryTracker } from "@/lib/useMasteryTracker";
import { fetchSrs, upsertSrs } from "@/lib/quest/repo";
import type { SRSPerformance } from "@/lib/quest/types";
import QuestStudyCard from "@/components/study/QuestStudyCard";
import { QuestProgress } from "@/components/QuestProgress";
import { Bloom, defaultBloomForType } from "@/lib/bloom";

const MISSION_LENGTHS = {
  quick: { min: 1, max: 10 },
  moderate: { min: 10, max: 15 },
  long: { min: 15, max: 30 },
} as const;

type MissionType = keyof typeof MISSION_LENGTHS;

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function toBloom(b: DeckBloomLevel | undefined, type: string): DeckBloomLevel {
  return (b ?? defaultBloomForType(type as DeckCardType)) as DeckBloomLevel;
}

export default function TargetClient({ deckId }: { deckId: number }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [order, setOrder] = useState<number[]>([]); // card IDs in play order
  const [idx, setIdx] = useState<number>(0);
  const [done, setDone] = useState<boolean>(false);
  const trackAnswer = useMasteryTracker();
  const srsRef = useRef<SRSPerformance>({});
  const perCardRef = useRef<Record<number, { attempts: number; correct: number }>>({});
  const perBloomRef = useRef<Record<string, { seen: number; correctFloat: number }>>({});
  const [correctSum, setCorrectSum] = useState(0);
  const startedIsoRef = useRef<string>(new Date().toISOString());
  const [finishing, setFinishing] = useState(false);

  const missionType = useMemo<MissionType | null>(() => {
    const v = sp?.get("type") as MissionType | null;
    return v && v in MISSION_LENGTHS ? v : null;
  }, [sp]);

  const targetN = useMemo(() => {
    if (!missionType) return 0;
    const config = MISSION_LENGTHS[missionType];
    return config.max; // aim for max, but will cap to available weak cards
  }, [missionType]);

  // Load deck cards and SRS data
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await cardsRepo.listByDeck(deckId);
      if (!alive) return;
      setCards(list);

      // Load SRS data
      try {
        const srsData = await fetchSrs(deckId);
        if (!alive) return;
        srsRef.current = srsData;
      } catch {}
    })();
    return () => { alive = false; };
  }, [deckId]);

  // Select weak cards
  useEffect(() => {
    if (!cards || !missionType) return;

    // Get SRS data
    const srs = srsRef.current;

    // Calculate weakness for each card
    const cardWeakness = cards.map((card) => {
      const srsEntry = srs[card.id];
      const attempts = srsEntry?.attempts ?? 0;
      const correct = srsEntry?.correct ?? 0;
      const accuracy = attempts > 0 ? correct / attempts : 0; // 0 for unseen
      const lastSeenAt = srsEntry?.lastSeenAt ? new Date(srsEntry.lastSeenAt).getTime() : 0;

      // Weakness score: lower accuracy is weaker, and more recent lastSeenAt is slightly prioritized
      // For ties in accuracy, more recent first (assuming recent activity might indicate weakness)
      const weakness = (1 - accuracy) * 1000000 + (Date.now() - lastSeenAt) / 1000; // arbitrary scaling

      return { card, weakness, accuracy, lastSeenAt };
    });

    // Sort by weakness descending (weakest first)
    cardWeakness.sort((a, b) => b.weakness - a.weakness);

    // Take up to targetN weakest
    const selected = cardWeakness.slice(0, targetN).map((cw) => cw.card);

    // Shuffle the selected cards
    const shuffled = shuffleInPlace([...selected]);

    setOrder(shuffled.map((c) => c.id));
    setIdx(0);
    setDone(shuffled.length === 0);
  }, [cards, missionType, targetN]);

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

  function trackLocal(payload: { cardId: number; bloom: Bloom; correctness?: number; correct?: boolean; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean; cardType: string }) {
    try {
      const val = typeof payload.correctness === "number" ? payload.correctness : (typeof payload.correct === "boolean" ? (payload.correct ? 1 : 0) : 0);
      setCorrectSum((s) => s + (Number.isFinite(val) ? val : 0));
      // accumulate per-card for SRS
      const incCorrect = typeof payload.correctness === 'number' ? Math.max(0, Math.min(1, payload.correctness)) : (payload.correct ? 1 : 0);
      const cur = perCardRef.current[payload.cardId] ?? { attempts: 0, correct: 0 };
      perCardRef.current[payload.cardId] = { attempts: cur.attempts + 1, correct: cur.correct + incCorrect };
      // accumulate per-bloom
      const bloomKey = payload.bloom;
      const bloomCur = perBloomRef.current[bloomKey] ?? { seen: 0, correctFloat: 0 };
      perBloomRef.current[bloomKey] = { seen: bloomCur.seen + 1, correctFloat: bloomCur.correctFloat + incCorrect };
    } catch {}
    return trackAnswer(payload).catch(() => {});
  }

  // Redirect to mission-complete when done
  useEffect(() => {
    if (!done || finishing) return;
    setFinishing(true);
    const total = Math.max(0, order.length);
    const correct = Math.max(0, correctSum);
    const pct = total > 0 ? Math.max(0, Math.min(100, (correct / total) * 100)) : 0;

    const q = new URLSearchParams();
    q.set("mode", "target_practice");
    q.set("pct", String(Math.round(pct * 10) / 10));
    q.set("total", String(total));
    q.set("correct", String(Math.round(correct)));
    q.set("level", "Target"); // aggregate level for display

    // Fire-and-forget finalize
    (async () => {
      // Persist SRS
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

      // Finalize economy
      try {
        const resp = await fetch(`/api/economy/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deckId, mode: "target_practice", correct: Math.round(correct), total, percent: Math.round(pct * 10) / 10 }),
        }).catch(() => null);
        if (resp && resp.ok) { await resp.json().catch(() => null); }
      } catch {}

      // Record mission attempt
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
        const answers = Object.entries(perCardRef.current).map(([cardIdStr, inc]) => ({
          cardId: Number(cardIdStr),
          correct: inc.attempts > 0 ? Math.max(0, Math.min(1, inc.correct / inc.attempts)) : 0,
        }));
        const resp = await fetch(`/api/quest/${deckId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "target_practice",
            // no bloom_level for target_practice, it's per level in breakdown
            score_pct: Math.round(pct * 10) / 10,
            cards_seen: total,
            cards_correct: Math.round(correct),
            started_at: startedIsoRef.current,
            ended_at: new Date().toISOString(),
            breakdown,
            answers,
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
  }, [done, order.length, correctSum, deckId, router, finishing]);

  // Render
  function renderStudy(c: DeckCard) {
    const effBloom = toBloom(c.bloomLevel as DeckBloomLevel | undefined, c.type);
    const bloomEnum = effBloom as Bloom;
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

  return (
    <main className="study-page min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="text-sm font-semibold text-slate-900">Target Practice</div>
          <div className="mt-1">
            <QuestProgress current={idx} total={order.length} color="#334155" label={`${Math.min(order.length, idx + 1)}/${order.length}`} />
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-start justify-center p-4">
        <div className="w-full max-w-xl">
          {current ? renderStudy(current) : <div>Loading...</div>}
        </div>
      </div>
    </main>
  );
}