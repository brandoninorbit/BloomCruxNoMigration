"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/browserClient";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckCard, DeckCardType, DeckBloomLevel } from "@/types/deck-cards";
import { Bloom, defaultBloomForType } from "@/lib/bloom";
import { useMasteryTracker } from "@/lib/useMasteryTracker";
import { fetchSrs, upsertSrs } from "@/lib/quest/repo";
import type { SRSPerformance } from "@/lib/quest/types";
import QuestStudyCard from "@/components/study/QuestStudyCard";
import { QuestProgress } from "@/components/QuestProgress";

function toBloom(b: DeckBloomLevel | undefined, type: DeckCardType): DeckBloomLevel {
  return (b ?? defaultBloomForType(type)) as DeckBloomLevel;
}

export default function StarredClient({ deckId }: { deckId: number }) {
  const router = useRouter();
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [correctSum, setCorrectSum] = useState(0);
  const trackAnswer = useMasteryTracker();
  const perBloomRef = useRef<Record<DeckBloomLevel, { seen: number; correctFloat: number }>>({ Remember: { seen: 0, correctFloat: 0 }, Understand: { seen: 0, correctFloat: 0 }, Apply: { seen: 0, correctFloat: 0 }, Analyze: { seen: 0, correctFloat: 0 }, Evaluate: { seen: 0, correctFloat: 0 }, Create: { seen: 0, correctFloat: 0 } });
  const startedIsoRef = useRef<string>(new Date().toISOString());
  const [finishing, setFinishing] = useState(false);
  const srsRef = useRef<SRSPerformance>({});
  const perCardRef = useRef<Record<number, { attempts: number; correct: number }>>({});

  // Load starred ids then cards
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("user_starred_cards").select("card_id").eq("deck_id", deckId);
      const ids = ((data ?? []) as Array<{ card_id: number }>).map((r) => Number(r.card_id));
      const all = await cardsRepo.listByDeck(deckId);
      if (!alive) return;
      const set = new Set(ids);
      const starred = all.filter((c) => set.has(c.id));
      setCards(starred);
      setOrder(starred.map((c) => c.id));
      setIdx(0);
      setDone(starred.length === 0);
  try { srsRef.current = await fetchSrs(deckId).catch(() => ({})); } catch {}
    })();
    return () => { alive = false; };
  }, [deckId]);

  const current: DeckCard | null = useMemo(() => {
    if (!cards) return null;
    const id = order[idx];
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
  const incCorrect = typeof payload.correctness === 'number' ? Math.max(0, Math.min(1, payload.correctness)) : (payload.correct ? 1 : 0);
  const cur = perCardRef.current[payload.cardId] ?? { attempts: 0, correct: 0 };
  perCardRef.current[payload.cardId] = { attempts: cur.attempts + 1, correct: cur.correct + incCorrect };
      // accumulate per-bloom
      const key = Bloom[payload.bloom] as unknown as DeckBloomLevel | undefined;
      if (key) {
        const map = perBloomRef.current;
        const cur = map[key] ?? { seen: 0, correctFloat: 0 };
        cur.seen += 1;
        cur.correctFloat += (Number.isFinite(val) ? val : 0);
        map[key] = cur;
        perBloomRef.current = map;
      }
    } catch {}
    return trackAnswer(payload).catch(() => {});
  }

  // redirect to mission-complete when done; also record an attempt row with per-bloom breakdown
  useEffect(() => {
    if (!done) return;
  setFinishing(true);
    const total = Math.max(0, order.length);
    const correct = Math.max(0, correctSum);
    const pct = total > 0 ? Math.max(0, Math.min(100, (correct / total) * 100)) : 0;
    const q = new URLSearchParams();
    q.set("mode", "starred");
    q.set("pct", String(Math.round(pct * 10) / 10));
    q.set("total", String(total));
    q.set("correct", String(Math.round(correct)));
    // Record mission attempt to update history and mastery per-bloom
    (async () => {
      // Persist per-card SRS attempts first
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
      // Finalize with breakdown and capture deltas
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
          body: JSON.stringify({ deckId, mode: "starred", correct: Math.round(correct), total, percent: Math.round(pct * 10) / 10, breakdown }),
        }).catch(() => null);
  if (resp && resp.ok) { await resp.json().catch(() => null); }
      } catch {}
      try {
        const map = perBloomRef.current;
        const breakdown: Record<string, { scorePct: number; cardsSeen: number; cardsCorrect: number }> = {};
        (Object.keys(map) as DeckBloomLevel[]).forEach((lvl) => {
          const seen = Math.max(0, Number(map[lvl]?.seen ?? 0));
          const correctFloat = Math.max(0, Number(map[lvl]?.correctFloat ?? 0));
          if (seen > 0) {
            const pctLvl = Math.max(0, Math.min(100, (correctFloat / seen) * 100));
            breakdown[lvl] = { scorePct: Math.round(pctLvl * 10) / 10, cardsSeen: seen, cardsCorrect: Math.round(correctFloat) };
          }
        });
        // Attribute to the first card's bloom if available, else Remember
        let attributed: DeckBloomLevel = "Remember" as DeckBloomLevel;
        try {
          const firstId = order[0];
          if (typeof firstId === 'number' && cards) {
            const c = cards.find((x) => x.id === firstId);
            if (c) {
              const eff = toBloom(c.bloomLevel as DeckBloomLevel | undefined, c.type);
              attributed = eff;
            }
          }
        } catch {}
        await fetch(`/api/quest/${deckId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "starred",
            bloom_level: attributed,
            score_pct: Math.round(pct * 10) / 10,
            cards_seen: total,
            cards_correct: Math.round(correct),
            started_at: startedIsoRef.current,
            ended_at: new Date().toISOString(),
            breakdown,
          }),
        }).catch(() => {});
      } catch {}
      router.replace(`/decks/${deckId}/mission-complete?${q.toString()}`);
    })();
  }, [done, order.length, correctSum, deckId, router, cards, order]);

  return (
    <main className="study-page min-h-screen flex flex-col">
      {/* Header area: mode title + progress */}
      <div className="p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="text-sm font-semibold text-slate-900">Starred Study</div>
          <div className="mt-1">
            <QuestProgress current={idx} total={order.length} color="#f59e0b" label={`${Math.min(order.length, idx + 1)}/${order.length}`} />
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
            ) : current ? (
              <QuestStudyCard
                card={current}
                onAnswer={(ev) => {
                  const effBloom = toBloom(current.bloomLevel as DeckBloomLevel | undefined, current.type);
                  const bloomEnum = Bloom[effBloom as keyof typeof Bloom];
                  const val = typeof ev.correctness === "number" ? ev.correctness : (typeof ev.correct === "boolean" ? (ev.correct ? 1 : 0) : 0);
                  trackLocal({ cardId: current.id, bloom: bloomEnum, correctness: val, correct: ev.correct, responseMs: ev.responseMs, confidence: ev.confidence, guessed: ev.guessed, cardType: current.type });
                }}
                onContinue={onContinue}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">No starred cards yet.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
