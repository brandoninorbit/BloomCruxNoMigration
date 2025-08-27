"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckBloomLevel, DeckCard } from "@/types/deck-cards";
import { BLOOM_COLOR_HEX } from "@/types/card-catalog";
import QuestStudyCard from "@/components/study/QuestStudyCard";
import { QuestProgress } from "@/components/QuestProgress";
import { Bloom } from "@/lib/bloom";
import { useMasteryTracker } from "@/lib/useMasteryTracker";
import { fetchSrs } from "@/lib/quest/repo";

function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i=a.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j]!,a[i]!]; } return a; }

export default function LevelUpClient({ deckId }: { deckId: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const level = useMemo(() => (sp?.get("level") as DeckBloomLevel) || ("Remember" as DeckBloomLevel), [sp]);
  const N = useMemo(() => Math.max(0, Number(sp?.get("n") || 0)), [sp]);
  const weakOnly = useMemo(() => (sp?.get("weak") === "1"), [sp]);

  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [correctSum, setCorrectSum] = useState(0);
  const tracker = useMasteryTracker();
  const startedIsoRef = useRef<string>(new Date().toISOString());
  const [baselineMastery, setBaselineMastery] = useState<number | null>(null);

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

  // Build order from chosen bloom and SRS weakness
  useEffect(() => {
    (async () => {
      if (!cards) return;
      // On first build, capture baseline mastery for the chosen level
      try {
  const res = await fetch(`/api/decks/${deckId}/mastery`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const m = (res?.mastery ?? {}) as Partial<Record<DeckBloomLevel, number>>;
  const before = Number(m?.[level] ?? NaN);
  if (Number.isFinite(before)) setBaselineMastery(Math.max(0, Math.min(100, Math.round(before))));
      } catch {}
      const poolAll = cards.filter((c) => (c.bloomLevel as DeckBloomLevel) === level);
      let pool = poolAll;
      if (weakOnly) {
        const srs = (await fetchSrs(deckId).catch(() => ({}))) as Record<number, { attempts?: number; correct?: number; lastSeenAt?: string | null }>;
        const scored = poolAll.map((c) => {
          const perf = srs[c.id] as { attempts?: number; correct?: number } | undefined;
          const attempts = Number(perf?.attempts ?? 0);
          const correct = Number(perf?.correct ?? 0);
          const ratio = attempts > 0 ? correct / Math.max(1, attempts) : 0;
          const score = attempts > 0 ? ratio : 1; // unseen default to strong, so exclude unless needed
          return { id: c.id, card: c, score };
        });
        const weak = scored.filter((s) => s.score < 0.7).sort((a,b) => a.score - b.score).map((s) => s.card);
        pool = weak.length > 0 ? weak : poolAll; // fallback to all if none weak
      }
      const shuffled = shuffle(pool);
      const take = N > 0 ? shuffled.slice(0, Math.min(N, shuffled.length)) : shuffled;
      setOrder(take.map((c) => c.id));
      setIdx(0);
      setDone(take.length === 0);
    })();
  }, [cards, level, weakOnly, deckId, N]);

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

  function onAnswer(ev: { cardId: number; correctness?: number; correct?: boolean; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean; cardType: string }) {
    const val = typeof ev.correctness === "number" ? ev.correctness : (typeof ev.correct === "boolean" ? (ev.correct ? 1 : 0) : 0);
    setCorrectSum((s) => s + (Number.isFinite(val) ? val : 0));
    const bloomEnum = Bloom[level as keyof typeof Bloom];
    tracker({ cardId: ev.cardId, bloom: bloomEnum, correctness: val, correct: ev.correct, responseMs: ev.responseMs, confidence: ev.confidence, guessed: ev.guessed, cardType: ev.cardType }).catch(() => {});
  }

  // Redirect to mission-complete when done
  useEffect(() => {
    if (!done) return;
    setFinishing(true);
    const total = Math.max(0, order.length);
    const correct = Math.max(0, correctSum);
    const pct = total > 0 ? Math.max(0, Math.min(100, (correct / total) * 100)) : 0;
    const q = new URLSearchParams();
    q.set("mode", "levelup");
    q.set("pct", String(Math.round(pct * 10) / 10));
    q.set("total", String(total));
    q.set("correct", String(Math.round(correct)));
    q.set("level", level);
    if (N > 0) q.set("n", String(N));
    if (weakOnly) q.set("weak", "1");
  if (typeof baselineMastery === "number") q.set("startMastery", String(Math.max(0, Math.min(100, Math.round(baselineMastery)))));
    (async () => {
      // Finalize with per-bloom breakdown first; capture deltas for display
      try {
        const breakdown = { [level]: { correct: Math.round(correct), total } } as Record<string, { correct: number; total: number }>;
        await fetch(`/api/economy/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deckId, mode: "levelup", correct: Math.round(correct), total, percent: Math.round(pct * 10) / 10, breakdown }),
        })
          .then((resp) => (resp && resp.ok ? resp.json() : null))
          .then(() => null)
          .catch(() => null);
      } catch {}
      try {
        await fetch(`/api/quest/${deckId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "levelup",
            bloom_level: level,
            score_pct: Math.round(pct * 10) / 10,
            cards_seen: total,
            cards_correct: Math.round(correct),
            started_at: startedIsoRef.current,
            ended_at: new Date().toISOString(),
          }),
        });
      } catch {}
      router.replace(`/decks/${deckId}/mission-complete?${q.toString()}`);
    })();
  }, [done, order.length, correctSum, deckId, router, level, N, weakOnly, baselineMastery]);

  const color = BLOOM_COLOR_HEX[level] || "#3b82f6";
  const left = Math.max(0, order.length - idx);

  return (
    <main className="study-page relative min-h-screen overflow-hidden">
      {/* Header area: mode title + progress */}
      <div className="absolute top-0 left-0 right-0 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-sm font-semibold text-slate-900">Level Up · {level}</div>
          <div className="mt-1">
            <QuestProgress current={idx} total={order.length} color={color} label={`${left} left`} />
          </div>
        </div>
      </div>
      <div className="absolute left-0 right-0 bottom-0 top-20 md:top-24 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-lg shadow p-6 max-h-[78vh] overflow-y-auto">
            {finishing ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" aria-label="Loading" />
              </div>
            ) : !done && current ? (
              <QuestStudyCard
                card={current}
                onAnswer={onAnswer}
                onContinue={onContinue}
              />
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" aria-label="Loading" />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
