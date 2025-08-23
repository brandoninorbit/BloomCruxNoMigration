"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckBloomLevel, DeckCard, DeckCardType, DeckFillMeta, DeckFillMetaV3, DeckSequencingMeta, DeckShortAnswer, DeckStandardMCQ, DeckSortingMeta, DeckCompareContrastMeta, DeckTwoTierMCQ, DeckCER, DeckCERMeta, DeckCERPart } from "@/types/deck-cards";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { defaultBloomForType, Bloom } from "@/lib/bloom";
import { useMasteryTracker } from "@/lib/useMasteryTracker";
import MCQStudy from "@/components/cards/MCQStudy";
import FillBlankStudy from "@/components/cards/FillBlankStudy";
import SequencingStudy from "@/components/cards/SequencingStudy";
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useDraggable, useSensor, useSensors, rectIntersection } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

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
  const [correctSum, setCorrectSum] = useState(0);
  const perBloomRef = useRef<Record<DeckBloomLevel, { seen: number; correctFloat: number }>>({ Remember: { seen: 0, correctFloat: 0 }, Understand: { seen: 0, correctFloat: 0 }, Apply: { seen: 0, correctFloat: 0 }, Analyze: { seen: 0, correctFloat: 0 }, Evaluate: { seen: 0, correctFloat: 0 }, Create: { seen: 0, correctFloat: 0 } });
  const startedIsoRef = useRef<string>(new Date().toISOString());

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
    try {
      void fetch(`/api/economy/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, mode: "remix", correct: Math.round(correct), total, percent: Math.round(pct * 10) / 10 }),
      }).catch(() => {});
    } catch {}
    // Also record a mission attempt to update progress/attempts history
    (async () => {
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
    const common = {
      onContinue,
    } as const;

    if (c.type === "Standard MCQ") {
      const mcq = c as DeckStandardMCQ;
      return (
        <MCQStudy
          prompt={mcq.question}
          options={[
            { key: "A", text: mcq.meta.options.A },
            { key: "B", text: mcq.meta.options.B },
            { key: "C", text: mcq.meta.options.C },
            { key: "D", text: mcq.meta.options.D },
          ]}
          answerKey={mcq.meta.answer}
          explanation={mcq.explanation}
          onAnswer={(res) => { trackLocal({ cardId: mcq.id, bloom: bloomEnum, correct: res.correct, responseMs: res.responseMs, confidence: res.confidence, guessed: res.guessed, cardType: mcq.type }); }}
          {...common}
        />
      );
    }

    if (c.type === "Fill in the Blank") {
      const fb = c as unknown as { question: string; meta: DeckFillMeta; explanation?: string };
      // Map V3 meta into component props
      const isV3 = (m: DeckFillMeta): m is DeckFillMetaV3 => (m as DeckFillMetaV3).blanks !== undefined;
      let blanks: { id: string | number; answers: string[]; hint?: string; mode?: "bank" | "free" | "either"; caseSensitive?: boolean; ignorePunct?: boolean }[] = [];
      let bank: string[] | undefined = undefined;
      if (isV3(fb.meta)) {
        blanks = fb.meta.blanks.map((b) => ({ id: b.id, answers: b.answers, hint: b.hint, mode: b.mode === "Drag & Drop" ? "bank" : b.mode === "Free Text" ? "free" : b.mode === "Either" ? "either" : undefined, caseSensitive: b.caseSensitive, ignorePunct: b.ignorePunct }));
        bank = Array.isArray(fb.meta.options) ? fb.meta.options : undefined;
      }
      return (
        <FillBlankStudy
          stem={fb.question}
          blanks={blanks}
          wordBank={bank}
          explanation={fb.explanation}
          onAnswer={(res) => {
            const total = blanks.length || 1;
            const numCorrect = Object.values(res.perBlank).filter(Boolean).length;
            const correctness = total ? numCorrect / total : (res.allCorrect ? 1 : 0);
            trackLocal({ cardId: (c.id), bloom: bloomEnum, correctness, responseMs: res.responseMs, confidence: res.confidence, guessed: res.guessed, cardType: c.type });
          }}
          {...common}
        />
      );
    }

    if (c.type === "Sequencing") {
      const seq = c as { question: string; meta: DeckSequencingMeta };
      return (
        <SequencingStudy
          prompt={seq.question}
          steps={seq.meta.steps}
          onAnswer={(res) => {
            const total = seq.meta.steps.length;
            const numCorrect = total && res.wrongIndexes ? Math.max(0, total - res.wrongIndexes.length) : (res.allCorrect ? total : 0);
            const correctness = total ? numCorrect / total : (res.allCorrect ? 1 : 0);
            trackLocal({ cardId: c.id, bloom: bloomEnum, correctness, responseMs: res.responseMs, confidence: res.confidence, guessed: res.guessed, cardType: c.type });
          }}
          {...common}
        />
      );
    }

    if (c.type === "Short Answer") {
      const sa = c as DeckShortAnswer;
      return (
        <ShortAnswerStudy
          card={sa}
          bloom={bloomEnum}
          onContinue={onContinue}
          onTrack={(payload) => trackLocal(payload)}
        />
      );
    }

    // Placeholder UIs for complex types (Sorting, Compare/Contrast, Two-Tier MCQ, CER)
    if (c.type === "Two-Tier MCQ") {
      return (
        <TwoTierStudy
          card={c as DeckTwoTierMCQ}
          bloom={bloomEnum}
          onContinue={onContinue}
          onTrack={(p) => trackLocal(p)}
        />
      );
    }

    if (c.type === "CER") {
      return (
        <CERStudy
          card={c as DeckCER}
          bloom={bloomEnum}
          onContinue={onContinue}
          onTrack={(p) => trackLocal(p)}
        />
      );
    }

    if (c.type === "Compare/Contrast") {
      return (
        <CompareContrastStudy
      card={c as DeckCard & { type: "Compare/Contrast"; meta: DeckCompareContrastMeta }}
          bloom={bloomEnum}
          onContinue={onContinue}
          onTrack={(p) => trackLocal(p)}
        />
      );
    }

    if (c.type === "Sorting") {
      return (
        <SortingStudy
      card={c as DeckCard & { type: "Sorting"; meta: DeckSortingMeta }}
          bloom={bloomEnum}
          onContinue={onContinue}
          onTrack={(p) => trackAnswer(p).catch(() => {})}
        />
      );
    }

    return null;
  }

  const total = order.length;
  const curNum = Math.min(total, idx + 1);

  return (
    <main className="study-page container mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="font-valid text-2xl font-semibold text-slate-900">Random Remix</h1>
        <p className="font-valid text-sm text-slate-600">Deck #{deckId} · {total > 0 ? `Card ${curNum} of ${total}` : "No cards match your filters"}</p>
      </div>
      {!done && current ? (
        renderStudy(current)
      ) : (
        <div className="rounded-xl border bg-slate-50 p-6 text-slate-700">
          <div className="text-lg font-semibold mb-1">Wrapping up…</div>
          <p className="text-sm">Redirecting to Mission Complete…</p>
        </div>
      )}
    </main>
  );
}

function ShortAnswerStudy({ card, bloom, onContinue, onTrack }: { card: DeckShortAnswer; bloom: Bloom; onContinue: () => void; onTrack: (p: { cardId: number; bloom: Bloom; correct: boolean; responseMs: number; cardType: string }) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const startRef = useRef<number>(Date.now());
  const responseMs = () => Date.now() - startRef.current;
  function judge() {
    const expected = String(card.meta.suggestedAnswer || "").trim().toLowerCase();
    const got = String(text).trim().toLowerCase();
    const correct = expected && got ? (expected === got || expected.includes(got) || got.includes(expected)) : false;
    setChecked(true);
    onTrack({ cardId: card.id, bloom, correct, responseMs: responseMs(), cardType: card.type });
  }
  return (
    <div className="w-full max-w-3xl">
      <h2 className="font-valid text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
      <input ref={ref} className="w-full rounded border px-3 py-2" placeholder="Type your answer" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-3 flex items-center gap-2">
        <button className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!text} onClick={judge}>Check</button>
        {checked && card.explanation ? <p className="text-sm text-slate-600">{card.explanation}</p> : null}
      </div>
      {checked && (
        <div className="mt-4 rounded-xl border px-4 py-3 flex items-center justify-between bg-slate-50">
          <div className="font-semibold">Answer recorded</div>
          <button type="button" className="px-4 py-2 rounded-lg font-medium bg-slate-900 text-white" onClick={onContinue}>Continue</button>
        </div>
      )}
    </div>
  );
}

function TwoTierStudy({ card, bloom, onContinue, onTrack }: { card: DeckTwoTierMCQ; bloom: Bloom; onContinue: () => void; onTrack: (p: { cardId: number; bloom: Bloom; correctness?: number; correct?: boolean; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean; cardType: string }) => void }) {
  const [tier1, setTier1] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [tier2, setTier2] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [guessed, setGuessed] = useState(false);
  const startRef = useRef<number>(Date.now());
  const trackedRef = useRef(false);
  const meta = card.meta;

  const onPick = (tier: 1 | 2, k: "A" | "B" | "C" | "D") => {
    if (checked) return;
    if (tier === 1) {
      if (tier1 != null) return; setTier1(k);
    } else {
      if (tier2 != null) return; setTier2(k);
      setChecked(true);
    }
  };

  const renderTier = (label: string, options: { A: string; B: string; C: string; D: string }, answer: "A"|"B"|"C"|"D", picked: "A"|"B"|"C"|"D"|null, disabled: boolean, onChoose: (k: "A"|"B"|"C"|"D") => void) => (
    <div className="w-full">
      <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["A","B","C","D"] as const).map((k) => {
          const text = options[k];
          let classes = "border-slate-200 hover:bg-slate-50";
          if (checked) {
            const isCorrect = k === answer;
            const isWrongChosen = picked === k && !isCorrect;
            if (isCorrect) classes = "border-green-500 bg-green-50";
            if (isWrongChosen) classes = "border-red-500 bg-red-50";
          } else if (picked === k) {
            classes = "border-blue-500 bg-blue-50";
          }
          return (
            <button key={k} type="button" disabled={disabled} onClick={() => onChoose(k)} className={`text-left rounded-lg border px-4 py-3 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${classes}`}>
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-700">{k}.</span>
                <span className="text-slate-800">{text}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const numCorrect = (tier1 === meta.tier1.answer ? 1 : 0) + (tier2 === meta.tier2.answer ? 1 : 0);
  const correctness = checked ? numCorrect / 2 : undefined;
  const allCorrect = checked && correctness === 1;

  // Track once on reveal
  useEffect(() => {
    if (checked && !trackedRef.current) {
      trackedRef.current = true;
      onTrack({ cardId: card.id, bloom, correctness, correct: correctness === 1 ? true : (correctness === 0 ? false : undefined), responseMs: Date.now() - startRef.current, confidence, guessed, cardType: card.type });
    }
  }, [checked, onTrack, card.id, bloom, correctness, confidence, guessed, card.type]);

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
      {!checked ? (
        <div className="mb-3 flex items-center gap-3">
          <label className="text-sm text-slate-600">Confidence</label>
          <select value={confidence ?? ""} onChange={(e) => setConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
            <option value="">-</option>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} />Guessed</label>
        </div>
      ) : null}
      {renderTier("Tier 1", meta.tier1.options, meta.tier1.answer, tier1, checked || tier1 != null, (k) => onPick(1, k))}
      {tier1 != null && (
        <>
          <div className="my-4 flex items-center justify-center"><div className="h-1 w-40 bg-slate-200 rounded-full" /></div>
          {renderTier("Tier 2", meta.tier2.options, meta.tier2.answer, tier2, checked || tier2 != null, (k) => onPick(2, k))}
          {checked && card.explanation ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-slate-700"><div className="font-semibold text-slate-900 mb-1">Explanation</div><div className="text-sm leading-relaxed">{card.explanation}</div></div>
          ) : null}
        </>
      )}
      {checked ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${allCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
          <div className="font-semibold">{allCorrect ? "Correct!" : "Not quite"}</div>
          <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={onContinue}>Continue</button>
        </div>
      ) : null}
    </div>
  );
}

function CERStudy({ card, bloom, onContinue, onTrack }: { card: DeckCER; bloom: Bloom; onContinue: () => void; onTrack: (p: { cardId: number; bloom: Bloom; correctness?: number; correct?: boolean; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean; cardType: string }) => void }) {
  const meta = card.meta as DeckCERMeta;
  const isMCQ = meta.mode === "Multiple Choice";
  const [mcqChoice, setMcqChoice] = useState<{ claim?: number; evidence?: number; reasoning?: number }>({});
  const [mcqChecked, setMcqChecked] = useState(false);
  const [mcqConfidence, setMcqConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [mcqGuessed, setMcqGuessed] = useState(false);
  const mcqStartRef = useRef<number>(Date.now());
  const mcqTracked = useRef(false);

  const [freeText, setFreeText] = useState<{ claim: string; evidence: string; reasoning: string }>({ claim: "", evidence: "", reasoning: "" });
  const [freeChecked, setFreeChecked] = useState(false);
  const [freeOverride, setFreeOverride] = useState<{ claim?: "right" | "wrong"; evidence?: "right" | "wrong"; reasoning?: "right" | "wrong" }>({});
  const [freeConfidence, setFreeConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [freeGuessed, setFreeGuessed] = useState(false);
  const freeStartRef = useRef<number>(Date.now());
  const freeTracked = useRef(false);

  const isCERMCQPart = (p: DeckCERPart): p is { options: string[]; correct: number } => 'options' in p && Array.isArray((p as { options?: string[] }).options) && 'correct' in p && typeof (p as { correct?: number }).correct === 'number';
  const getCERSample = (p: DeckCERPart): string | undefined => ('sampleAnswer' in p ? (p as { sampleAnswer?: string }).sampleAnswer : undefined);

  // Effects at top-level guarded by mode
  useEffect(() => {
    if (!isMCQ) return;
    if (mcqChecked && !mcqTracked.current) {
      mcqTracked.current = true;
      const parts: Array<{ key: keyof typeof mcqChoice; correct: number }> = [
        { key: "claim", correct: isCERMCQPart(meta.claim) ? meta.claim.correct : -1 },
        { key: "evidence", correct: isCERMCQPart(meta.evidence) ? meta.evidence.correct : -1 },
        { key: "reasoning", correct: isCERMCQPart(meta.reasoning) ? meta.reasoning.correct : -1 },
      ];
      const total = parts.length;
      const numCorrect = parts.filter((p) => (mcqChoice[p.key] ?? -2) === p.correct).length;
      const correctness = total ? numCorrect / total : 0;
      onTrack({ cardId: card.id, bloom, correctness, correct: correctness === 1 ? true : (correctness === 0 ? false : undefined), responseMs: Date.now() - mcqStartRef.current, confidence: mcqConfidence, guessed: mcqGuessed, cardType: card.type });
    }
  }, [isMCQ, mcqChecked, mcqChoice, onTrack, card.id, bloom, mcqConfidence, mcqGuessed, card.type, meta.claim, meta.evidence, meta.reasoning]);

  useEffect(() => {
    if (isMCQ) return;
    if (freeChecked && !freeTracked.current) {
      freeTracked.current = true;
      const weights: Record<keyof typeof freeOverride, number> = { claim: 0.2, evidence: 0.4, reasoning: 0.4 };
      const keys = Object.keys(weights) as Array<keyof typeof freeOverride>;
      const totalWeight = keys.reduce((s, k) => s + weights[k], 0);
      const score = keys.reduce((s, k) => s + ((freeOverride[k] === "right") ? weights[k] : 0), 0);
      const correctness = totalWeight > 0 ? score / totalWeight : 0;
      onTrack({ cardId: card.id, bloom, correctness, correct: correctness === 1 ? true : (correctness === 0 ? false : undefined), responseMs: Date.now() - freeStartRef.current, confidence: freeConfidence, guessed: freeGuessed, cardType: card.type });
    }
  }, [isMCQ, freeChecked, freeOverride, onTrack, card.id, bloom, freeConfidence, freeGuessed, card.type]);

  if (isMCQ) {
    const parts: Array<{ key: keyof typeof mcqChoice; label: string; options: string[]; correct: number }> = [
      { key: "claim", label: "Claim", options: isCERMCQPart(meta.claim) ? meta.claim.options : [], correct: isCERMCQPart(meta.claim) ? meta.claim.correct : -1 },
      { key: "evidence", label: "Evidence", options: isCERMCQPart(meta.evidence) ? meta.evidence.options : [], correct: isCERMCQPart(meta.evidence) ? meta.evidence.correct : -1 },
      { key: "reasoning", label: "Reasoning", options: isCERMCQPart(meta.reasoning) ? meta.reasoning.options : [], correct: isCERMCQPart(meta.reasoning) ? meta.reasoning.correct : -1 },
    ];

    const pick = (k: keyof typeof mcqChoice, idx: number) => {
      if (mcqChecked) return;
      const next = { ...mcqChoice, [k]: idx };
      setMcqChoice(next);
      const allAnswered = parts.every((p) => typeof next[p.key] === "number");
      if (allAnswered) setMcqChecked(true);
    };

    const allCorrect = mcqChecked && parts.every((p) => (mcqChoice[p.key] ?? -2) === p.correct);

    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">{card.question}</h2>
        {!mcqChecked ? (
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm text-slate-600">Confidence</label>
            <select value={mcqConfidence ?? ""} onChange={(e) => setMcqConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
              <option value="">-</option>
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={mcqGuessed} onChange={(e) => setMcqGuessed(e.target.checked)} />Guessed</label>
          </div>
        ) : null}
        <div className="space-y-4">
          {parts.map((p) => (
            <div key={p.key as string}>
              <div className="text-sm font-medium text-slate-700 mb-2">{p.label}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {p.options.map((opt, i) => {
                  const chosen = mcqChoice[p.key];
                  let classes = "border-slate-200 hover:bg-slate-50";
                  if (mcqChecked) {
                    const isCorrect = i === p.correct;
                    const isWrongChosen = chosen === i && !isCorrect;
                    if (isCorrect) classes = "border-green-500 bg-green-50";
                    if (isWrongChosen) classes = "border-red-500 bg-red-50";
                  } else if (chosen === i) {
                    classes = "border-blue-500 bg-blue-50";
                  }
                  return (
                    <button key={`${p.key}-${i}`} type="button" onClick={() => pick(p.key, i)} className={`text-left rounded-lg border px-4 py-3 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${classes}`}>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-slate-700">{String.fromCharCode(65 + i)}.</span>
                        <span className="text-slate-800">{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {mcqChecked && card.explanation ? (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-slate-700"><div className="font-semibold text-slate-900 mb-1">Explanation</div><div className="text-sm leading-relaxed">{card.explanation}</div></div>
        ) : null}
        {mcqChecked ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${allCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
            <div className="font-semibold">{allCorrect ? "Correct!" : "Not quite"}</div>
            <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={onContinue}>Continue</button>
          </div>
        ) : null}
      </div>
    );
  }

  // Free Text mode
  const partsFT: Array<{ key: keyof typeof freeText; label: string; sample?: string }> = [
    { key: "claim", label: "Claim", sample: getCERSample(meta.claim) },
    { key: "evidence", label: "Evidence", sample: getCERSample(meta.evidence) },
    { key: "reasoning", label: "Reasoning", sample: getCERSample(meta.reasoning) },
  ];

  // effect handled above

  const allOk = freeChecked && (freeOverride.claim === "right") && (freeOverride.evidence === "right") && (freeOverride.reasoning === "right");

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">{card.question}</h2>
      {!freeChecked ? (
        <div className="mb-3 flex items-center gap-3">
          <label className="text-sm text-slate-600">Confidence</label>
          <select value={freeConfidence ?? ""} onChange={(e) => setFreeConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
            <option value="">-</option>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={freeGuessed} onChange={(e) => setFreeGuessed(e.target.checked)} />Guessed</label>
        </div>
      ) : null}
      <div className="space-y-4">
        {partsFT.map((p) => (
          <div key={p.key as string} className="rounded-lg border border-slate-200 p-3 bg-white">
            <div className="text-sm font-semibold text-slate-800 mb-2">{p.label}</div>
            <textarea className={`w-full rounded-lg border p-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${freeChecked ? (freeOverride[p.key] === "right" ? "border-green-500" : "border-red-500") : "border-slate-300"}`} rows={3} placeholder={`Write your ${p.label.toLowerCase()}...`} value={freeText[p.key]} onChange={(e) => !freeChecked && setFreeText((prev) => ({ ...prev, [p.key]: e.target.value }))} readOnly={freeChecked} />
            {freeChecked ? (
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="flex-1 text-sm text-slate-700">
                  <div className="font-medium text-slate-900 mb-1">Sample answer</div>
                  <div className="text-slate-700">{p.sample || "No sample answer provided."}</div>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <button type="button" className="px-2 py-1 rounded-md border border-green-500 text-green-600 hover:bg-green-50 text-xs" onClick={() => setFreeOverride((prev) => ({ ...prev, [p.key]: "right" }))}>I was right</button>
                  <button type="button" className="px-2 py-1 rounded-md border border-red-500 text-red-600 hover:bg-red-50 text-xs" onClick={() => setFreeOverride((prev) => ({ ...prev, [p.key]: "wrong" }))}>I was wrong</button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {!freeChecked ? (
        <div className="mt-4"><button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" onClick={() => setFreeChecked(true)} disabled={!(freeText.claim || freeText.evidence || freeText.reasoning)}>Check Answers</button></div>
      ) : null}
      {freeChecked && card.explanation ? (<div className="mt-3 text-sm text-slate-600">{card.explanation}</div>) : null}
      {freeChecked ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${allOk ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
          <div className="font-semibold">{allOk ? "Correct!" : "Not quite"}</div>
          <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allOk ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={onContinue}>Continue</button>
        </div>
      ) : null}
    </div>
  );
}

function CompareContrastStudy({ card, bloom, onContinue, onTrack }: { card: DeckCard & { type: "Compare/Contrast"; meta: DeckCompareContrastMeta }; bloom: Bloom; onContinue: () => void; onTrack: (p: { cardId: number; bloom: Bloom; correctness?: number; correct?: boolean; confidence?: 0|1|2|3; guessed?: boolean; cardType: string }) => void }) {
  const meta = card.meta;
  const itemA = meta.itemA; const itemB = meta.itemB; const rows = meta.points;
  const [ccA, setCcA] = useState<Record<number, string>>({});
  const [ccB, setCcB] = useState<Record<number, string>>({});
  const [override, setOverride] = useState<Record<number, "right" | "wrong" | undefined>>({});
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [guessed, setGuessed] = useState(false);
  const trackedRef = useRef(false);

  const normalize = (s: string) => s.trim().toLowerCase().replace(/[\p{P}\p{S}]/gu, "").replace(/\s+/g, " ");
  const tokenize = (s: string) => normalize(s).split(" ").filter(Boolean);
  const jaccard = (a: string, b: string) => { const A = new Set(tokenize(a)); const B = new Set(tokenize(b)); if (A.size === 0 && B.size === 0) return 1; let inter = 0; for (const t of A) if (B.has(t)) inter++; const uni = new Set([...A, ...B]).size; return uni > 0 ? inter / uni : 0; };
  const levenshteinRatio = (a: string, b: string) => { const s = normalize(a); const t = normalize(b); const n = s.length; const m = t.length; if (n === 0 && m === 0) return 1; if (n === 0 || m === 0) return 0; const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0)); for (let i = 0; i <= n; i++) dp[i][0] = i; for (let j = 0; j <= m; j++) dp[0][j] = j; for (let i = 1; i <= n; i++) { for (let j = 1; j <= m; j++) { const cost = s[i - 1] === t[j - 1] ? 0 : 1; dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost); } } const dist = dp[n][m]; const maxLen = Math.max(n, m); return maxLen > 0 ? 1 - dist / maxLen : 1; };
  const similarity = (a: string, b: string) => Math.max(jaccard(a, b), levenshteinRatio(a, b));
  const fuzzyEqual = (user: string, expected: string, threshold = 0.72) => similarity(user, expected) >= threshold;

  const effectiveRowCorrect = (idx: number) => {
    const pt = rows[idx]; const ov = override[idx];
    if (ov === "right") return true; if (ov === "wrong") return false;
    const aOk = fuzzyEqual(ccA[idx] ?? "", pt.a ?? ""); const bOk = fuzzyEqual(ccB[idx] ?? "", pt.b ?? "");
    return aOk && bOk;
  };

  const checkNow = () => {
    setChecked(true);
    if (!trackedRef.current) {
      trackedRef.current = true;
      const total = rows.length;
      let numCorrect = 0; for (let i = 0; i < rows.length; i++) if (effectiveRowCorrect(i)) numCorrect++;
      const correctness = total ? numCorrect / total : 0;
      onTrack({ cardId: card.id, bloom, correctness, correct: correctness === 1 ? true : (correctness === 0 ? false : undefined), confidence, guessed, cardType: card.type });
    }
  };

  const allCorrect = checked && rows.every((_, i) => effectiveRowCorrect(i));

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
      <div className="overflow-x-auto"><div className="inline-block min-w-full align-middle"><div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50"><tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Feature</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{itemA}</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{itemB}</th>
            <th className="px-2 py-3 text-right text-sm font-medium text-slate-400">Self-mark</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((pt, idx) => (
              <tr key={idx} className="align-top">
                <td className="px-4 py-3 text-sm text-slate-800 bg-slate-50 min-w-[160px]">{pt.feature}</td>
                <td className="px-4 py-3">
                  <textarea className={`w-full rounded-lg border p-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${checked ? (effectiveRowCorrect(idx) ? "border-green-500" : "border-red-500") : "border-slate-300"}`} rows={2} placeholder={`How does ${pt.feature} relate to ${itemA}?`} value={ccA[idx] ?? ""} onChange={(e) => { if (!checked) setCcA((prev) => ({ ...prev, [idx]: e.target.value })); }} readOnly={checked} />
                </td>
                <td className="px-4 py-3">
                  <textarea className={`w-full rounded-lg border p-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${checked ? (effectiveRowCorrect(idx) ? "border-green-500" : "border-red-500") : "border-slate-300"}`} rows={2} placeholder={`How does ${pt.feature} relate to ${itemB}?`} value={ccB[idx] ?? ""} onChange={(e) => { if (!checked) setCcB((prev) => ({ ...prev, [idx]: e.target.value })); }} readOnly={checked} />
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-right">
                  {checked ? (
                    <div className="inline-flex gap-2">
                      <button type="button" className="px-2 py-1 rounded-md border border-green-500 text-green-600 hover:bg-green-50 text-xs" onClick={() => setOverride((prev) => ({ ...prev, [idx]: "right" }))}>I was right</button>
                      <button type="button" className="px-2 py-1 rounded-md border border-red-500 text-red-600 hover:bg-red-50 text-xs" onClick={() => setOverride((prev) => ({ ...prev, [idx]: "wrong" }))}>I was wrong</button>
                    </div>
                  ) : <span className="text-xs text-slate-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div></div>
      {!checked ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm text-slate-600" htmlFor="cc-confidence">Confidence</label>
            <select id="cc-confidence" value={confidence ?? ""} onChange={(e) => setConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
              <option value="">-</option>
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} />Guessed</label>
          </div>
          <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white" onClick={checkNow}>Check Answers</button>
        </div>
      ) : null}
      {checked ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${allCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
          <div className="font-semibold">{allCorrect ? "Correct!" : "Not quite"}</div>
          <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={onContinue}>Continue</button>
        </div>
      ) : null}
    </div>
  );
}

function SortingStudy({ card, bloom, onContinue, onTrack }: { card: DeckCard & { type: "Sorting"; meta: DeckSortingMeta }; bloom: Bloom; onContinue: () => void; onTrack: (p: { cardId: number; bloom: Bloom; correctness?: number; correct?: boolean; confidence?: 0|1|2|3; guessed?: boolean; cardType: string }) => void }) {
  const meta = card.meta;
  const categories = meta.categories;
  const items = meta.items.map((it) => it.term);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [allCorrect, setAllCorrect] = useState<boolean | null>(null);
  const [confidence, setConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [guessed, setGuessed] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const trackedRef = useRef(false);

  function DraggableChip({ id, text }: { id: string; text: string }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
    const style: React.CSSProperties = { transform: CSS.Translate.toString(transform) };
    return (
      <div ref={setNodeRef} style={style} className={`px-2 py-1 rounded border text-sm bg-white shadow-sm ${checked ? "opacity-70" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-75 dragging" : ""}`} {...(!checked ? { ...attributes, ...listeners } : {})}>{text}</div>
    );
  }

  function DropZone({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    const { isOver, setNodeRef } = useDroppable({ id });
    return (
      <div className={`rounded-lg border ${isOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50"} p-3 min-h-[80px]`} ref={!checked ? setNodeRef : undefined}>
        <div className="text-xs font-medium text-slate-500 mb-2">{title}</div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    );
  }

  const tokensInCategory = (cat: string) => items.filter((t) => assignments[t] === cat);
  const unsorted = items.filter((t) => !assignments[t]);

  const onDragEnd = (e: DragEndEvent) => {
    if (checked) return;
    const tokenId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : undefined;
    if (!overId) return;
    if (overId === "unsorted") {
      setAssignments((prev) => { const next = { ...prev }; delete next[tokenId]; return next; });
    } else if (overId.startsWith("cat:")) {
      const cat = overId.slice(4);
      setAssignments((prev) => ({ ...prev, [tokenId]: cat }));
    }
  };

  const checkNow = () => {
    const correctByTerm: Record<string, string> = {}; for (const it of meta.items) correctByTerm[it.term] = it.correctCategory;
    const ok = items.every((t) => assignments[t] && assignments[t] === correctByTerm[t]);
    setAllCorrect(ok); setChecked(true);
    if (!trackedRef.current) {
      trackedRef.current = true;
      const total = items.length; const numCorrect = items.filter((t) => assignments[t] && assignments[t] === correctByTerm[t]).length;
      const correctness = total ? numCorrect / total : 0;
      onTrack({ cardId: card.id, bloom, correctness, correct: correctness === 1 ? true : (correctness === 0 ? false : undefined), confidence, guessed, cardType: card.type });
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
      <DndContext sensors={sensors} onDragEnd={onDragEnd} collisionDetection={rectIntersection}>
        <div className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
          <DropZone id="unsorted" title="Unsorted">
            {unsorted.map((t) => (<DraggableChip key={t} id={t} text={t} />))}
          </DropZone>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <DropZone id={`cat:${cat}`} key={cat} title={cat}>
                {tokensInCategory(cat).map((t) => (<DraggableChip key={`${cat}:${t}`} id={t} text={t} />))}
              </DropZone>
            ))}
          </div>
        </div>
      </DndContext>
      {!checked ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm text-slate-600" htmlFor="sort-confidence">Confidence</label>
            <select id="sort-confidence" value={confidence ?? ""} onChange={(e) => setConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
              <option value="">-</option>
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} />Guessed</label>
          </div>
          <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" onClick={checkNow} disabled={items.length === 0}>Check Answer</button>
        </div>
      ) : null}
      {checked ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${allCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
          <div className="font-semibold">{allCorrect ? "Correct!" : "Not quite"}</div>
          <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={onContinue}>Continue</button>
        </div>
      ) : null}
    </div>
  );
}
