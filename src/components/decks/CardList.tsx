"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as starsRepo from "@/lib/starsRepo";
import type { DeckCard, DeckBloomLevel, DeckMCQMeta, DeckShortMeta, DeckFillMeta, DeckFillMetaV3, DeckSortingMeta, DeckSequencingMeta, DeckCompareContrastMeta, DeckTwoTierMCQMeta, DeckCERMeta, DeckShortAnswer, DeckStandardMCQ, DeckFillBlank, DeckSorting, DeckCompareContrast, DeckTwoTierMCQ, DeckCER, DeckCERPart } from "@/types/deck-cards";
import AddCardModal from "@/components/decks/AddCardModal";
import Modal from "@/components/ui/Modal";
// Removed: MCQCard (we render an interactive inline version tailored for modal study)
import FillBlankStudy from "@/components/cards/FillBlankStudy";
import SequencingStudy from "@/components/cards/SequencingStudy";
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, rectIntersection } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMasteryTracker } from "@/lib/useMasteryTracker";
import { Bloom, defaultBloomForType } from "@/lib/bloom";
// (consolidated all deck-card type imports above)

export type CardListProps = {
  cards: DeckCard[];
  onEdit: (card: DeckCard) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onContinue?: () => void;
};

export default function CardList({ cards, onEdit, onDelete, onContinue }: CardListProps) {
  const items = useMemo(() => cards, [cards]);
  const deckId = items[0]?.deckId;
  const [starred, setStarred] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!deckId) return;
      try {
        const ids = await starsRepo.listStarredIds(deckId);
        if (!alive) return;
        const map: Record<number, boolean> = {};
        for (const id of ids) map[id] = true;
        setStarred(map);
      } catch {}
    })();
    return () => { alive = false; };
  }, [deckId]);

  async function toggleStar(cardId: number, deckId: number) {
    const next = !starred[cardId];
    setStarred((m) => ({ ...m, [cardId]: next }));
    try { await starsRepo.setStar(cardId, deckId, next); } catch {
      // revert on failure
      setStarred((m) => ({ ...m, [cardId]: !next }));
    }
  }
  const [editing, setEditing] = useState<DeckCard | null>(null);
  const [studying, setStudying] = useState<DeckCard | null>(null);
  // MCQ modal interaction state
  const [mcqChosen, setMcqChosen] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [mcqChecked, setMcqChecked] = useState(false);
  const [mcqConfidence, setMcqConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [mcqGuessed, setMcqGuessed] = useState(false);
  const [mcqResponseMs, setMcqResponseMs] = useState<number | undefined>(undefined);
  const mcqStartRef = useRef<number>(Date.now());
  const mcqTrackedRef = useRef(false);
  const [fibResult, setFibResult] = useState<{
    perBlank: Record<string | number, boolean>;
    allCorrect: boolean;
    filledText: string;
    mode: "auto";
  } | null>(null);
  // Sequencing banner state (track last result only)
  const [seqChecked, setSeqChecked] = useState(false);
  const [seqResult, setSeqResult] = useState<{ allCorrect: boolean; wrongIndexes?: number[] } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  // Short Answer state
  const [saText, setSaText] = useState("");
  const [saChecked, setSaChecked] = useState(false);
  const [saJudged, setSaJudged] = useState<null | "yes" | "no">(null);
  // Sorting state
  const [sortAssignments, setSortAssignments] = useState<Record<string, string>>({}); // term -> category (or unset => unsorted)
  const [sortChecked, setSortChecked] = useState(false);
  const [sortAllCorrect, setSortAllCorrect] = useState<boolean | null>(null);
  const [sortConfidence, setSortConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [sortGuessed, setSortGuessed] = useState(false);
  // Compare/Contrast state
  const [ccA, setCcA] = useState<Record<number, string>>({}); // row index -> answer for item A
  const [ccB, setCcB] = useState<Record<number, string>>({}); // row index -> answer for item B
  const [ccChecked, setCcChecked] = useState(false);
  const [ccOverride, setCcOverride] = useState<Record<number, "right" | "wrong" | undefined>>({});
  const [ccAllCorrect, setCcAllCorrect] = useState<boolean | null>(null);
  const ccARefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const ccBRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const [ccConfidence, setCcConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [ccGuessed, setCcGuessed] = useState(false);
  // Two-Tier MCQ state
  const [ttTier1, setTtTier1] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [ttTier2, setTtTier2] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [ttChecked, setTtChecked] = useState(false);
  // Two-Tier telemetry
  const [ttConfidence, setTtConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [ttGuessed, setTtGuessed] = useState(false);
  const [ttResponseMs, setTtResponseMs] = useState<number | undefined>(undefined);
  const ttStartRef = useRef<number>(Date.now());
  // CER state
  const [cerMCQChoice, setCerMCQChoice] = useState<{ claim?: number; evidence?: number; reasoning?: number }>({});
  const [cerMCQChecked, setCerMCQChecked] = useState(false);
  const [cerFreeText, setCerFreeText] = useState<{ claim: string; evidence: string; reasoning: string }>({ claim: "", evidence: "", reasoning: "" });
  const [cerFreeChecked, setCerFreeChecked] = useState(false);
  const [cerFreeOverride, setCerFreeOverride] = useState<{ claim?: "right" | "wrong"; evidence?: "right" | "wrong"; reasoning?: "right" | "wrong" }>({});
  // CER telemetry
  const [cerMCQConfidence, setCerMCQConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [cerMCQGuessed, setCerMCQGuessed] = useState(false);
  const [cerMCQResponseMs, setCerMCQResponseMs] = useState<number | undefined>(undefined);
  const cerMCQStartRef = useRef<number>(Date.now());
  const [cerFreeConfidence, setCerFreeConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [cerFreeGuessed, setCerFreeGuessed] = useState(false);
  const [cerFreeResponseMs, setCerFreeResponseMs] = useState<number | undefined>(undefined);
  const cerFreeStartRef = useRef<number>(Date.now());
  // Mastery tracking
  const trackAnswer = useMasteryTracker();
  const ttTrackedRef = useRef(false);
  const cerMCQTrackedRef = useRef(false);
  const cerFreeTrackedRef = useRef(false);
  const sortTrackedRef = useRef(false);
  const ccTrackedRef = useRef(false);

  // Helpers for CER type narrowing
  const isCERMCQPart = (p: DeckCERPart): p is { options: string[]; correct: number } => {
    const obj = p as Record<string, unknown>;
    return Array.isArray(obj.options) && typeof obj.correct === "number";
  };
  const getCERSample = (p: DeckCERPart) => ("sampleAnswer" in p ? p.sampleAnswer : undefined);

  useEffect(() => {
    // Reset interaction whenever a different card is opened/closed
    setMcqChosen(null);
    setMcqChecked(false);
    setFibResult(null);
    setMcqConfidence(undefined);
    setMcqGuessed(false);
    setMcqResponseMs(undefined);
    mcqStartRef.current = Date.now();
    mcqTrackedRef.current = false;
  setSaText("");
  setSaChecked(false);
  setSaJudged(null);
  // reset sequencing state
  setSeqChecked(false);
  setSeqResult(null);
  // reset sorting state
  setSortAssignments({});
  setSortChecked(false);
  setSortAllCorrect(null);
  setSortConfidence(undefined);
  setSortGuessed(false);
  // reset compare/contrast state
  setCcA({});
  setCcB({});
  setCcChecked(false);
  setCcOverride({});
  setCcAllCorrect(null);
  ccARefs.current = {};
  ccBRefs.current = {};
  setCcConfidence(undefined);
  setCcGuessed(false);
  // reset two-tier mcq
  setTtTier1(null);
  setTtTier2(null);
  setTtChecked(false);
  setTtConfidence(undefined);
  setTtGuessed(false);
  setTtResponseMs(undefined);
  ttStartRef.current = Date.now();
  // reset CER
  setCerMCQChoice({});
  setCerMCQChecked(false);
  setCerFreeText({ claim: "", evidence: "", reasoning: "" });
  setCerFreeChecked(false);
  setCerFreeOverride({});
  setCerMCQConfidence(undefined);
  setCerMCQGuessed(false);
  setCerMCQResponseMs(undefined);
  cerMCQStartRef.current = Date.now();
  setCerFreeConfidence(undefined);
  setCerFreeGuessed(false);
  setCerFreeResponseMs(undefined);
  cerFreeStartRef.current = Date.now();
  ttTrackedRef.current = false;
  cerMCQTrackedRef.current = false;
  cerFreeTrackedRef.current = false;
  sortTrackedRef.current = false;
  ccTrackedRef.current = false;
  }, [studying]);


  type ModalSubmitPayload = {
    type: DeckCard["type"];
    bloomLevel?: DeckBloomLevel;
    question: string;
    explanation?: string;
  meta: DeckMCQMeta | DeckShortMeta | DeckFillMeta | DeckSortingMeta | DeckSequencingMeta | DeckCompareContrastMeta | DeckTwoTierMCQMeta | DeckCERMeta;
  };

  const submitEdit = async (payload: ModalSubmitPayload) => {
    if (!editing) return;
    const common = {
      id: editing.id,
      deckId: editing.deckId,
      question: payload.question,
      explanation: payload.explanation,
      bloomLevel: payload.bloomLevel,
      position: editing.position,
      createdAt: editing.createdAt,
      updatedAt: editing.updatedAt,
    };

    if (payload.type === "Standard MCQ") {
      await onEdit({ ...common, type: "Standard MCQ", meta: payload.meta as DeckMCQMeta });
    } else if (payload.type === "Short Answer") {
      await onEdit({ ...common, type: "Short Answer", meta: payload.meta as DeckShortMeta });
    } else if (payload.type === "Sorting") {
      await onEdit({ ...common, type: "Sorting", meta: payload.meta as DeckSortingMeta });
    } else if (payload.type === "Sequencing") {
      await onEdit({ ...common, type: "Sequencing", meta: payload.meta as DeckSequencingMeta });
    } else if (payload.type === "Compare/Contrast") {
      await onEdit({ ...common, type: "Compare/Contrast", meta: payload.meta as DeckCompareContrastMeta });
    } else if (payload.type === "Two-Tier MCQ") {
      await onEdit({ ...common, type: "Two-Tier MCQ", meta: payload.meta as DeckTwoTierMCQMeta });
    } else if (payload.type === "Fill in the Blank") {
      await onEdit({ ...common, type: "Fill in the Blank", meta: payload.meta as DeckFillMeta });
    } else if (payload.type === "CER") {
      await onEdit({ ...common, type: "CER", meta: payload.meta as DeckCERMeta });
    }
    setEditing(null);
  };

  // Helper renderers to keep JSX simple (avoid IIFEs inside JSX)
  const renderMCQ = (card: DeckStandardMCQ) => {
    const answer = card.meta.answer;
    const options: Array<["A"|"B"|"C"|"D", string]> = [
      ["A", card.meta.options.A],
      ["B", card.meta.options.B],
      ["C", card.meta.options.C],
      ["D", card.meta.options.D],
    ];
    const hoverTint = "#4DA6FF22";
    const handlePick = (k: "A"|"B"|"C"|"D") => {
      if (mcqChecked) return;
      setMcqChosen(k);
      setMcqChecked(true);
      setMcqResponseMs((_) => Date.now() - mcqStartRef.current);
    };
    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map(([k, text]) => {
            const isChosen = mcqChosen === k;
            const isCorrect = mcqChecked && k === answer;
            const isWrong = mcqChecked && isChosen && !isCorrect;
            return (
              <button
                key={k}
                type="button"
                onClick={() => handlePick(k)}
                className={`text-left rounded-lg border px-4 py-3 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                  isCorrect
                    ? "border-green-500 bg-green-50"
                    : isWrong
                    ? "border-red-500 bg-red-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
                onMouseEnter={(e) => { if (!mcqChecked) (e.currentTarget as HTMLElement).style.backgroundColor = hoverTint; }}
                onMouseLeave={(e) => { if (!mcqChecked) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
              >
                <div className="flex items-start gap-2">
                  <span className="font-bold text-slate-700">{k}.</span>
                  <span className="text-slate-800">{text}</span>
                </div>
              </button>
            );
          })}
        </div>
        {!mcqChecked ? (
          <div className="mt-4 flex items-center gap-3">
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
        {mcqChecked && card.explanation ? (
          <div className="mt-4 overflow-hidden transition-all duration-300">
            <div className="rounded-lg bg-slate-50 p-4 text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">Explanation</div>
              <div className="text-sm leading-relaxed">{card.explanation}</div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderShortAnswer = (card: DeckShortAnswer) => {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          rows={4}
          placeholder="Type your answer..."
          value={saText}
          onChange={(e) => !saChecked && setSaText(e.target.value)}
          readOnly={saChecked}
        />
        <div className="mt-4">
          {!saChecked ? (
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
              onClick={() => setSaChecked(true)}
              disabled={saText.trim().length === 0}
            >
              Check Answer
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="font-semibold text-slate-900 mb-1">Suggested answer</div>
                <div className="text-slate-800 font-semibold">{card.meta.suggestedAnswer || "No suggested answer."}</div>
                {card.explanation ? <div className="mt-3 text-sm text-slate-600">{card.explanation}</div> : null}
              </div>
              {saJudged == null ? (
                <div className="flex items-center justify-between">
                  <div className="text-slate-700 font-medium">Did you get it right?</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSaJudged("yes")}
                      className="group inline-flex items-center gap-2 rounded-lg border border-green-500 px-3 py-2 text-green-600 hover:bg-green-500 hover:text-white transition-colors"
                    >
                      <svg className="h-5 w-5 text-green-600 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaJudged("no")}
                      className="group inline-flex items-center gap-2 rounded-lg border border-red-500 px-3 py-2 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <svg className="h-5 w-5 text-red-600 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      No
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTwoTierMCQ = (card: DeckTwoTierMCQ) => {
    const t1 = card.meta.tier1;
    const t2 = card.meta.tier2;

    const renderTier = (
      tier: 1 | 2,
      prompt: string,
      options: { A: string; B: string; C: string; D: string },
      answer: "A" | "B" | "C" | "D"
    ) => {
      const chosen = tier === 1 ? ttTier1 : ttTier2;
      const showOutcome = ttChecked; // only after both tiers answered
      const opts: Array<["A" | "B" | "C" | "D", string]> = [
        ["A", options.A],
        ["B", options.B],
        ["C", options.C],
        ["D", options.D],
      ];
    const onPick = (k: "A" | "B" | "C" | "D") => {
        if (tier === 1) {
          if (ttTier1 != null) return; // lock tier1 once picked
          setTtTier1(k);
        } else {
          if (ttTier2 != null) return; // lock tier2 once picked
          setTtTier2(k);
          // after tier2 pick, reveal outcomes
      setTtChecked(true);
      setTtResponseMs((_) => Date.now() - ttStartRef.current);
        }
      };
      return (
        <div className="w-full">
          <div className="text-sm font-medium text-slate-700 mb-2">{tier === 1 ? "Tier 1" : "Tier 2"}</div>
          <h3 className="text-lg font-semibold mb-3 text-slate-900">{prompt}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {opts.map(([k, text]) => {
              const isChosen = chosen === k;
              let classes = "border-slate-200 hover:bg-slate-50";
              if (showOutcome) {
                const isCorrect = k === answer;
                const isWrongChosen = isChosen && !isCorrect;
                if (isCorrect) classes = "border-green-500 bg-green-50";
                if (isWrongChosen) classes = "border-red-500 bg-red-50";
              } else if (isChosen) {
                classes = "border-blue-500 bg-blue-50";
              }
              return (
                <button
                  key={`${tier}-${k}`}
                  type="button"
                  disabled={tier === 1 ? ttTier1 != null : ttTier2 != null}
                  onClick={() => onPick(k)}
                  className={`text-left rounded-lg border px-4 py-3 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${classes}`}
                >
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
    };

    const showTier2 = ttTier1 != null;
    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
        {!ttChecked ? (
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm text-slate-600">Confidence</label>
            <select value={ttConfidence ?? ""} onChange={(e) => setTtConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
              <option value="">-</option>
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={ttGuessed} onChange={(e) => setTtGuessed(e.target.checked)} />Guessed</label>
          </div>
        ) : null}
        {renderTier(1, t1.options ? (/* no separate prompt field, reuse card.question for tier 1 if needed */ card.question) : card.question, t1.options, t1.answer)}
        {showTier2 ? (
          <>
            <div className="my-4 flex items-center justify-center">
              <div className="h-1 w-40 bg-slate-200 rounded-full" />
            </div>
            {renderTier(2, t2.question, t2.options, t2.answer)}
            {ttChecked && card.explanation ? (
              <div className="mt-4 rounded-lg bg-slate-50 p-4 text-slate-700">
                <div className="font-semibold text-slate-900 mb-1">Explanation</div>
                <div className="text-sm leading-relaxed">{card.explanation}</div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  };

  const renderCER = (card: DeckCER) => {
  const meta = card.meta as DeckCERMeta;
    const title = card.question;
    const guidance = meta.guidanceQuestion;

    const renderHeader = () => (
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {guidance ? <div className="mt-1 text-base font-semibold text-slate-700">{guidance}</div> : null}
      </div>
    );

  if (meta.mode === "Multiple Choice") {
      const parts: Array<{ key: keyof typeof cerMCQChoice; label: string; options: string[]; correct: number }> = [
  { key: "claim", label: "Claim", options: isCERMCQPart(meta.claim) ? meta.claim.options : [], correct: isCERMCQPart(meta.claim) ? meta.claim.correct : -1 },
  { key: "evidence", label: "Evidence", options: isCERMCQPart(meta.evidence) ? meta.evidence.options : [], correct: isCERMCQPart(meta.evidence) ? meta.evidence.correct : -1 },
  { key: "reasoning", label: "Reasoning", options: isCERMCQPart(meta.reasoning) ? meta.reasoning.options : [], correct: isCERMCQPart(meta.reasoning) ? meta.reasoning.correct : -1 },
      ];

      const pick = (k: keyof typeof cerMCQChoice, idx: number) => {
        if (cerMCQChecked) return;
        const next = { ...cerMCQChoice, [k]: idx };
        setCerMCQChoice(next);
        const allAnswered = parts.every((p) => typeof next[p.key] === "number");
        if (allAnswered) {
          setCerMCQChecked(true);
          setCerMCQResponseMs((_) => Date.now() - cerMCQStartRef.current);
        }
      };

      return (
        <div className="w-full">
          {renderHeader()}
          {!cerMCQChecked ? (
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-slate-600">Confidence</label>
              <select value={cerMCQConfidence ?? ""} onChange={(e) => setCerMCQConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
                <option value="">-</option>
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
              <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={cerMCQGuessed} onChange={(e) => setCerMCQGuessed(e.target.checked)} />Guessed</label>
            </div>
          ) : null}
          <div className="space-y-4">
            {parts.map((p) => (
              <div key={p.key as string}>
                <div className="text-sm font-medium text-slate-700 mb-2">{p.label}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {p.options.map((opt, i) => {
                    const chosen = cerMCQChoice[p.key];
                    const showOutcome = cerMCQChecked;
                    let classes = "border-slate-200 hover:bg-slate-50";
                    if (showOutcome) {
                      const isCorrect = i === p.correct;
                      const isWrongChosen = chosen === i && !isCorrect;
                      if (isCorrect) classes = "border-green-500 bg-green-50";
                      if (isWrongChosen) classes = "border-red-500 bg-red-50";
                    } else if (chosen === i) {
                      classes = "border-blue-500 bg-blue-50";
                    }
                    return (
                      <button
                        key={`${p.key}-${i}`}
                        type="button"
                        onClick={() => pick(p.key, i)}
                        className={`text-left rounded-lg border px-4 py-3 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${classes}`}
                      >
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
          {cerMCQChecked && card.explanation ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">Explanation</div>
              <div className="text-sm leading-relaxed">{card.explanation}</div>
            </div>
          ) : null}
          {/* Banner handled by outer section */}
        </div>
      );
    }

  // Free Text mode
  const partsFT: Array<{ key: keyof typeof cerFreeText; label: string; sample?: string }> = [
      { key: "claim", label: "Claim", sample: getCERSample(meta.claim) },
      { key: "evidence", label: "Evidence", sample: getCERSample(meta.evidence) },
      { key: "reasoning", label: "Reasoning", sample: getCERSample(meta.reasoning) },
    ];

    const checkFT = () => {
      setCerFreeChecked(true);
      setCerFreeResponseMs((_) => Date.now() - cerFreeStartRef.current);
    };
    const partOk = (k: keyof typeof cerFreeOverride) => cerFreeOverride[k] === "right";

    return (
      <div className="w-full">
        {renderHeader()}
        {!cerFreeChecked ? (
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm text-slate-600">Confidence</label>
            <select value={cerFreeConfidence ?? ""} onChange={(e) => setCerFreeConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
              <option value="">-</option>
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={cerFreeGuessed} onChange={(e) => setCerFreeGuessed(e.target.checked)} />Guessed</label>
          </div>
        ) : null}
        <div className="space-y-4">
          {partsFT.map((p) => (
            <div key={p.key as string} className="rounded-lg border border-slate-200 p-3 bg-white">
              <div className="text-sm font-semibold text-slate-800 mb-2">{p.label}</div>
              <textarea
                className={`w-full rounded-lg border p-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${cerFreeChecked ? (partOk(p.key) ? "border-green-500" : "border-red-500") : "border-slate-300"}`}
                rows={3}
                placeholder={`Write your ${p.label.toLowerCase()}...`}
                value={cerFreeText[p.key]}
                onChange={(e) => !cerFreeChecked && setCerFreeText((prev) => ({ ...prev, [p.key]: e.target.value }))}
                readOnly={cerFreeChecked}
              />
              {cerFreeChecked ? (
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="flex-1 text-sm text-slate-700">
                    <div className="font-medium text-slate-900 mb-1">Sample answer</div>
                    <div className="text-slate-700">{p.sample || "No sample answer provided."}</div>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <button type="button" className="px-2 py-1 rounded-md border border-green-500 text-green-600 hover:bg-green-50 text-xs" onClick={() => setCerFreeOverride((prev) => ({ ...prev, [p.key]: "right" }))}>I was right</button>
                    <button type="button" className="px-2 py-1 rounded-md border border-red-500 text-red-600 hover:bg-red-50 text-xs" onClick={() => setCerFreeOverride((prev) => ({ ...prev, [p.key]: "wrong" }))}>I was wrong</button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {!cerFreeChecked ? (
          <div className="mt-4">
            <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" onClick={checkFT} disabled={!(cerFreeText.claim || cerFreeText.evidence || cerFreeText.reasoning)}>
              Check Answers
            </button>
          </div>
        ) : null}
        {cerFreeChecked && card.explanation ? (
          <div className="mt-3 text-sm text-slate-600">{card.explanation}</div>
        ) : null}
      </div>
    );
  };

  const renderCompareContrast = (card: DeckCompareContrast) => {
    const meta = card.meta;
    const itemA = meta.itemA;
    const itemB = meta.itemB;
    const rows = meta.points; // { feature, a, b }

    const normalize = (s: string) => s.trim().toLowerCase().replace(/[\p{P}\p{S}]/gu, "").replace(/\s+/g, " ");
    const tokenize = (s: string) => normalize(s).split(" ").filter(Boolean);
    const jaccard = (a: string, b: string) => {
      const A = new Set(tokenize(a));
      const B = new Set(tokenize(b));
      if (A.size === 0 && B.size === 0) return 1;
      let inter = 0; for (const t of A) if (B.has(t)) inter++;
      const uni = new Set([...A, ...B]).size;
      return uni > 0 ? inter / uni : 0;
    };
    const levenshteinRatio = (a: string, b: string) => {
      const s = normalize(a);
      const t = normalize(b);
      const n = s.length; const m = t.length;
      if (n === 0 && m === 0) return 1;
      if (n === 0 || m === 0) return 0;
      const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
      for (let i = 0; i <= n; i++) dp[i][0] = i;
      for (let j = 0; j <= m; j++) dp[0][j] = j;
      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
          const cost = s[i - 1] === t[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1, // insertion
            dp[i - 1][j - 1] + cost // substitution
          );
        }
      }
      const dist = dp[n][m];
      const maxLen = Math.max(n, m);
      return maxLen > 0 ? 1 - dist / maxLen : 1;
    };
    const similarity = (a: string, b: string) => {
      // Take the max of token-level and char-level similarities
      return Math.max(jaccard(a, b), levenshteinRatio(a, b));
    };
    const fuzzyEqual = (user: string, expected: string, threshold = 0.72) => similarity(user, expected) >= threshold;

    const checkNow = () => {
      // compute whether all rows are correct (either exact match for both cells, or overridden as right)
      const all = rows.every((pt, idx) => {
        const ov = ccOverride[idx];
        if (ov === "right") return true;
        if (ov === "wrong") return false;
        const aOk = fuzzyEqual(ccA[idx] ?? "", pt.a ?? "");
        const bOk = fuzzyEqual(ccB[idx] ?? "", pt.b ?? "");
        return aOk && bOk;
      });
      setCcAllCorrect(all);
      setCcChecked(true);
      // Persist mastery/telemetry: compute fraction = (# rows correct) / total rows
      if (!ccTrackedRef.current) {
        ccTrackedRef.current = true;
        const total = rows.length;
        let numCorrect = 0;
        for (let i = 0; i < rows.length; i++) if (effectiveRowCorrect(i)) numCorrect++;
        const correctness = total ? numCorrect / total : (all ? 1 : 0);
        const legacy = correctness >= 1 ? true : (correctness === 0 ? false : undefined);
        trackAnswer({
          cardId: (studying as DeckCompareContrast).id,
          bloom: ((studying as DeckCompareContrast).bloomLevel as Bloom) || (defaultBloomForType((studying as DeckCompareContrast).type) as Bloom),
          correctness,
          correct: legacy,
          confidence: ccConfidence,
          guessed: ccGuessed,
          cardType: (studying as DeckCompareContrast).type,
        }).catch(() => {});
      }
      // Next frame: shrink textareas to their content height
      requestAnimationFrame(() => {
        const resizeMap = (map: Record<number, HTMLTextAreaElement | null>) => {
          Object.values(map).forEach((el) => {
            if (!el) return;
            el.style.height = "auto";
            el.style.overflow = "hidden";
            el.style.height = `${el.scrollHeight}px`;
          });
        };
        resizeMap(ccARefs.current);
        resizeMap(ccBRefs.current);
      });
    };

    const effectiveRowCorrect = (idx: number) => {
      const pt = rows[idx];
      const ov = ccOverride[idx];
      if (ov === "right") return true;
      if (ov === "wrong") return false;
  const aOk = fuzzyEqual(ccA[idx] ?? "", pt.a ?? "");
  const bOk = fuzzyEqual(ccB[idx] ?? "", pt.b ?? "");
      return aOk && bOk;
    };

    const cellClass = (idx: number) => {
      if (!ccChecked) return "border-slate-300";
      return effectiveRowCorrect(idx) ? "border-green-500" : "border-red-500";
    };

    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Feature</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{itemA}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{itemB}</th>
                    <th className="px-2 py-3 text-right text-sm font-medium text-slate-400">Self-mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((pt, idx) => {
                    const placeholderA = `How does ${pt.feature} relate to ${itemA}?`;
                    const placeholderB = `How does ${pt.feature} relate to ${itemB}?`;
                    return (
                      <tr key={idx} className="align-top">
                        <td className="px-4 py-3 text-sm text-slate-800 bg-slate-50 min-w-[160px]">{pt.feature}</td>
                        <td className="px-4 py-3">
                          <textarea
                            className={`w-full rounded-lg border p-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${cellClass(idx)}`}
                            rows={2}
                            placeholder={placeholderA}
                            value={ccA[idx] ?? ""}
                            onChange={(e) => { if (!ccChecked) setCcA((prev) => ({ ...prev, [idx]: e.target.value })); }}
                            readOnly={ccChecked}
                            ref={(el) => { ccARefs.current[idx] = el; }}
                          />
                          {ccChecked && !effectiveRowCorrect(idx) && (rows[idx]?.a ?? "").trim().length > 0 ? (
                            <div className="mt-2 text-xs text-green-700">
                              <span className="font-semibold">Right answer:</span> {rows[idx]!.a}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <textarea
                            className={`w-full rounded-lg border p-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${cellClass(idx)}`}
                            rows={2}
                            placeholder={placeholderB}
                            value={ccB[idx] ?? ""}
                            onChange={(e) => { if (!ccChecked) setCcB((prev) => ({ ...prev, [idx]: e.target.value })); }}
                            readOnly={ccChecked}
                            ref={(el) => { ccBRefs.current[idx] = el; }}
                          />
                          {ccChecked && !effectiveRowCorrect(idx) && (rows[idx]?.b ?? "").trim().length > 0 ? (
                            <div className="mt-2 text-xs text-green-700">
                              <span className="font-semibold">Right answer:</span> {rows[idx]!.b}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap text-right">
                          {ccChecked ? (
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 rounded-md border border-green-500 text-green-600 hover:bg-green-50 text-xs"
                                onClick={() => setCcOverride((prev) => ({ ...prev, [idx]: "right" }))}
                              >
                                I was right
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 rounded-md border border-red-500 text-red-600 hover:bg-red-50 text-xs"
                                onClick={() => setCcOverride((prev) => ({ ...prev, [idx]: "wrong" }))}
                              >
                                I was wrong
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {!ccChecked ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-slate-600" htmlFor="cc-confidence">Confidence</label>
              <select id="cc-confidence" value={ccConfidence ?? ""} onChange={(e) => setCcConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
                <option value="">-</option>
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
              <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={ccGuessed} onChange={(e) => setCcGuessed(e.target.checked)} />Guessed</label>
            </div>
            <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white" onClick={checkNow}>
              Check Answers
            </button>
          </div>
        ) : null}
        {ccChecked && card.explanation ? (
          <div className="mt-3 text-sm text-slate-600">{card.explanation}</div>
        ) : null}
      </div>
    );
  };

  const renderSorting = (card: DeckCard & { type: "Sorting" }) => {
    const meta = card.meta as DeckSortingMeta;
    const categories = meta.categories;
    const items = meta.items.map((it) => it.term);
    const disabled = sortChecked; // lock after check

    function DraggableChip({ id, text }: { id: string; text: string }) {
      const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
      const style: React.CSSProperties = { transform: CSS.Translate.toString(transform) };
      return (
        <div
          ref={setNodeRef}
          style={style}
          className={`px-2 py-1 rounded border text-sm bg-white shadow-sm ${disabled ? "opacity-70" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-75 dragging" : ""}`}
          {...(!disabled ? { ...attributes, ...listeners } : {})}
        >
          {text}
        </div>
      );
    }

    function DropZone({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
      const { isOver, setNodeRef } = useDroppable({ id });
      return (
        <div className={`rounded-lg border ${isOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50"} p-3 min-h-[80px]`}
             ref={!disabled ? setNodeRef : undefined}>
          <div className="text-xs font-medium text-slate-500 mb-2">{title}</div>
          <div className="flex flex-wrap gap-2">{children}</div>
        </div>
      );
    }

    const tokensInCategory = (cat: string) => items.filter((t) => sortAssignments[t] === cat);
    const unsorted = items.filter((t) => !sortAssignments[t]);

    const onDragEnd = (e: DragEndEvent) => {
      if (disabled) return;
      const tokenId = String(e.active.id);
      const overId = e.over?.id ? String(e.over.id) : undefined;
      if (!overId) return;
      if (overId === "unsorted") {
        setSortAssignments((prev) => {
          const next = { ...prev };
          delete next[tokenId];
          return next;
        });
      } else if (overId.startsWith("cat:")) {
        const cat = overId.slice(4);
        setSortAssignments((prev) => ({ ...prev, [tokenId]: cat }));
      }
    };

    const checkNow = () => {
      const correctByTerm: Record<string, string> = {};
      for (const it of meta.items) correctByTerm[it.term] = it.correctCategory;
      const allCorrect = items.every((t) => sortAssignments[t] && sortAssignments[t] === correctByTerm[t]);
      setSortAllCorrect(allCorrect);
      setSortChecked(true);
    };

    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
        <DndContext sensors={sensors} onDragEnd={onDragEnd} collisionDetection={rectIntersection}>
          <div className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
            <DropZone id="unsorted" title="Unsorted">
              {unsorted.map((t) => (
                <DraggableChip key={t} id={t} text={t} />
              ))}
            </DropZone>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => (
                <DropZone id={`cat:${cat}`} key={cat} title={cat}>
                  {tokensInCategory(cat).map((t) => (
                    <DraggableChip key={`${cat}:${t}`} id={t} text={t} />
                  ))}
                </DropZone>
              ))}
            </div>
          </div>
        </DndContext>
        {!sortChecked ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-slate-600" htmlFor="sort-confidence">Confidence</label>
              <select id="sort-confidence" value={sortConfidence ?? ""} onChange={(e) => setSortConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
                <option value="">-</option>
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
              <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={sortGuessed} onChange={(e) => setSortGuessed(e.target.checked)} />Guessed</label>
            </div>
            <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" onClick={checkNow} disabled={items.length === 0}>
              Check Answer
            </button>
          </div>
        ) : null}
        {sortChecked && card.explanation ? (
          <div className="mt-3 text-sm text-slate-600">{card.explanation}</div>
        ) : null}
      </div>
    );
  };


  return (
    <>
      <ul className="space-y-3">
        {items.map((card) => (
          <li key={card.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              {/* Left: question, type, bloom */}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{card.question || "Untitled"}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {card.type}
                  {card.bloomLevel ? <span className="text-gray-400"> · {card.bloomLevel}</span> : null}
                </p>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2">
                <IconButton label="Star" onClick={() => toggleStar(card.id, card.deckId)}>
                  <StarIcon filled={Boolean(starred[card.id])} />
                </IconButton>
                <IconButton label="View" onClick={() => setStudying(card)}>
                  <EyeIcon />
                </IconButton>
                <IconButton label="Edit" onClick={() => setEditing(card)}>
                  <EditIcon />
                </IconButton>
                <IconButton label="Delete" onClick={() => onDelete(card.id)} danger>
                  <TrashIcon />
                </IconButton>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AddCardModal
        open={Boolean(editing)}
        mode="edit"
        initialCard={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={submitEdit}
      />

      {/* Study single card modal */}
      <Modal open={Boolean(studying)} onClose={() => setStudying(null)}>
        <div className="w-full max-w-xl mx-auto min-h-[320px]">
          <div className="bg-white rounded-lg shadow p-6">
            {studying ? (
              <>
                {studying.type === "Standard MCQ" && renderMCQ(studying as DeckStandardMCQ)}
                {studying.type === "Fill in the Blank" && (
                  (() => {
                    const meta = (studying as DeckFillBlank).meta;
                    function isV3(m: unknown): m is DeckFillMetaV3 { return !!m && typeof m === "object" && "blanks" in m; }
                    const blanks = isV3(meta)
                      ? meta.blanks.map((b) => ({
                          ...b,
                          mode: b.mode === "Free Text" ? "free" : b.mode === "Drag & Drop" ? "bank" : b.mode === "Either" ? "either" : undefined as "free" | "bank" | "either" | undefined,
                        }))
                      : [];
                    const wordBank = isV3(meta) && Array.isArray(meta.options) ? meta.options : [];
                    return (
                      <FillBlankStudy
                        stem={studying.question}
                        blanks={blanks}
                        wordBank={wordBank}
                        explanation={studying.explanation}
                        submitLabel="Submit answer"
                        onAnswer={(res) => {
                          setFibResult(res);
                          // compute fraction = (# correct blanks) / (total blanks)
                          const per = res.perBlank || {};
                          const total = Object.keys(per).length || 0;
                          const numCorrect = total ? Object.values(per).filter(Boolean).length : (res.allCorrect ? 1 : 0);
                          const correctness = total ? numCorrect / total : (res.allCorrect ? 1 : 0);
                          const legacy = correctness >= 1 ? true : (correctness === 0 ? false : undefined);
                          trackAnswer({
                            cardId: studying.id,
                            bloom: (studying.bloomLevel as Bloom) || (defaultBloomForType(studying.type) as Bloom),
                            correctness,
                            correct: legacy,
                            responseMs: res.responseMs,
                            confidence: res.confidence,
                            guessed: res.guessed,
                            cardType: studying.type,
                          }).catch(() => {});
                        }}
                      />
                    );
                  })()
                )}
                {studying.type === "Short Answer" && renderShortAnswer(studying as DeckShortAnswer)}
                {studying.type === "CER" && renderCER(studying as DeckCER)}
                {studying.type === "Two-Tier MCQ" && renderTwoTierMCQ(studying as DeckTwoTierMCQ)}
                {studying.type === "Compare/Contrast" && renderCompareContrast(studying as DeckCompareContrast)}
                {studying.type === "Sorting" && renderSorting(studying as DeckSorting)}
                {studying.type === "Sequencing" && (
                  <SequencingStudy
                    prompt={studying.question}
                    steps={(studying.meta as DeckSequencingMeta).steps}
                    onAnswer={(res) => {
                      // optional handling inside CardList study modal (no mission state here)
                      // keep seqResult visible by updating local state
                      setSeqResult({ allCorrect: res.allCorrect, wrongIndexes: res.wrongIndexes });
                      setSeqChecked(true);
                      // persist mastery - sequencing: fraction = (# positions correct) / total
                      const total = (studying.meta as DeckSequencingMeta).steps.length;
                      const numCorrect = total && res.wrongIndexes ? Math.max(0, total - res.wrongIndexes.length) : (res.allCorrect ? total : 0);
                      const correctness = total ? numCorrect / total : (res.allCorrect ? 1 : 0);
                      const legacy = correctness >= 1 ? true : (correctness === 0 ? false : undefined);
                      trackAnswer({
                        cardId: studying.id,
                        bloom: (studying.bloomLevel as Bloom) || (defaultBloomForType(studying.type) as Bloom),
                        correctness,
                        correct: legacy,
                        responseMs: res.responseMs,
                        confidence: res.confidence,
                        guessed: res.guessed,
                        cardType: studying.type,
                      }).catch(() => {});
                    }}
                    onContinue={() => {
                      // prefer parent-provided handler (for quest), otherwise close modal
                      if (typeof onContinue === "function") onContinue();
                      else setStudying(null);
                    }}
                  />
                )}
              </>
            ) : (
              <div className="text-center text-gray-400 py-12">No study UI for this card type yet.</div>
            )}

            {/* Bottom status banner */}
            {studying?.type === "Standard MCQ" && mcqChecked ? (
              (() => {
                const card = studying as DeckStandardMCQ;
                const correct = mcqChosen === card.meta.answer;
                if (!mcqTrackedRef.current) {
                  mcqTrackedRef.current = true;
                  trackAnswer({
                    cardId: card.id,
                    bloom: (card.bloomLevel as Bloom) || (defaultBloomForType(card.type) as Bloom),
                    correct,
                    responseMs: mcqResponseMs,
                    confidence: mcqConfidence,
                    guessed: mcqGuessed,
                    cardType: card.type,
                  }).catch(() => {});
                }
                return (
                  <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${correct ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                    <div className="font-semibold">{correct ? "Correct!" : "Not quite"}</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`px-4 py-2 rounded-lg font-medium shadow-sm ${correct ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}
                        onClick={() => { if (typeof onContinue === "function") onContinue(); else setStudying(null); }}
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : studying?.type === "Fill in the Blank" && fibResult ? (
              <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${fibResult.allCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                <div className="font-semibold">{fibResult.allCorrect ? "Correct!" : "Not quite"}</div>
                <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${fibResult.allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={() => { if (typeof onContinue === "function") onContinue(); else setStudying(null); }}>
                  Continue
                </button>
              </div>
            ) : studying?.type === "Short Answer" && saChecked && saJudged !== null ? (
              <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${saJudged === "yes" ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                <div className="font-semibold">{saJudged === "yes" ? "Correct!" : "Not quite"}</div>
                <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${saJudged === "yes" ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={() => { if (typeof onContinue === "function") onContinue(); else setStudying(null); }}>
                  Continue
                </button>
              </div>
            ) : studying?.type === "Sorting" && sortChecked && sortAllCorrect !== null ? (
              (() => {
                if (!sortTrackedRef.current) {
                  sortTrackedRef.current = true;
                  // compute fraction = (# correctly placed) / total items
                  const meta = (studying as DeckSorting).meta as DeckSortingMeta;
                  const correctByTerm: Record<string, string> = {};
                  for (const it of meta.items) correctByTerm[it.term] = it.correctCategory;
                  const itemsList = meta.items.map((it) => it.term);
                  const total = itemsList.length;
                  const numCorrect = itemsList.filter((t) => sortAssignments[t] && sortAssignments[t] === correctByTerm[t]).length;
                  const correctness = total ? numCorrect / total : (sortAllCorrect ? 1 : 0);
                  const legacy = correctness >= 1 ? true : (correctness === 0 ? false : undefined);
                  trackAnswer({
                    cardId: (studying as DeckSorting).id,
                    bloom: ((studying as DeckSorting).bloomLevel as Bloom) || (defaultBloomForType((studying as DeckSorting).type) as Bloom),
                    correctness,
                    correct: legacy,
                    confidence: sortConfidence,
                    guessed: sortGuessed,
                    cardType: (studying as DeckSorting).type,
                  }).catch(() => {});
                }
                return (
              <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${sortAllCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                <div className="font-semibold">{sortAllCorrect ? "Correct!" : "Not quite"}</div>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg font-medium shadow-sm ${sortAllCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}
                  onClick={() => { if (typeof onContinue === "function") onContinue(); else setStudying(null); }}
                >
                  Continue
                </button>
              </div>);
              })()
            ) : studying?.type === "Two-Tier MCQ" && ttChecked ? (
              (() => {
                const meta = (studying as DeckTwoTierMCQ).meta;
                const allCorrect = (ttTier1 === meta.tier1.answer) && (ttTier2 === meta.tier2.answer);
                // Persist mastery/telemetry once on reveal
                if (!ttTrackedRef.current) {
                  ttTrackedRef.current = true;
                  // Two-tier: both tiers must be correct for full credit. Here treat as fraction: (# correct tiers) / 2
                  const numCorrect = (ttTier1 === meta.tier1.answer ? 1 : 0) + (ttTier2 === meta.tier2.answer ? 1 : 0);
                  const correctness = numCorrect / 2;
                  const legacy = correctness >= 1 ? true : (correctness === 0 ? false : undefined);
                  trackAnswer({
                    cardId: (studying as DeckTwoTierMCQ).id,
                    bloom: ((studying as DeckTwoTierMCQ).bloomLevel as Bloom) || (defaultBloomForType((studying as DeckTwoTierMCQ).type) as Bloom),
                    correctness,
                    correct: legacy,
                    responseMs: ttResponseMs,
                    confidence: ttConfidence,
                    guessed: ttGuessed,
                    cardType: (studying as DeckTwoTierMCQ).type,
                  }).catch(() => {});
                }
                return (
                  <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${allCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                    <div className="font-semibold">{allCorrect ? "Correct!" : "Not quite"}</div>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}
                      onClick={() => { if (typeof onContinue === "function") onContinue(); else setStudying(null); }}
                    >
                      Continue
                    </button>
                  </div>
                );
              })()
            ) : studying?.type === "CER" && (studying.meta as DeckCERMeta).mode === "Multiple Choice" && cerMCQChecked ? (
              (() => {
                const m = (studying as DeckCER).meta as DeckCERMeta;
                const parts = [
                  { key: "claim", correct: isCERMCQPart(m.claim) ? m.claim.correct : -1 },
                  { key: "evidence", correct: isCERMCQPart(m.evidence) ? m.evidence.correct : -1 },
                  { key: "reasoning", correct: isCERMCQPart(m.reasoning) ? m.reasoning.correct : -1 },
                ] as const;
                const allCorrect = parts.every((p) => (cerMCQChoice[p.key] ?? -2) === p.correct);
                if (!cerMCQTrackedRef.current) {
                  cerMCQTrackedRef.current = true;
                  // CER MCQ parts: compute fraction = (# correct parts) / 3
                  const partsArr = parts;
                  const totalParts = partsArr.length;
                  const numCorrectParts = partsArr.filter((p) => (cerMCQChoice[p.key] ?? -2) === p.correct).length;
                  const correctness = totalParts ? numCorrectParts / totalParts : (allCorrect ? 1 : 0);
                  const legacy = correctness >= 1 ? true : (correctness === 0 ? false : undefined);
                  trackAnswer({
                    cardId: (studying as DeckCER).id,
                    bloom: ((studying as DeckCER).bloomLevel as Bloom) || (defaultBloomForType((studying as DeckCER).type) as Bloom),
                    correctness,
                    correct: legacy,
                    responseMs: cerMCQResponseMs,
                    confidence: cerMCQConfidence,
                    guessed: cerMCQGuessed,
                    cardType: (studying as DeckCER).type,
                  }).catch(() => {});
                }
                return (
                  <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${allCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                    <div className="font-semibold">{allCorrect ? "Correct!" : "Not quite"}</div>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}
                      onClick={() => { if (typeof onContinue === "function") onContinue(); else setStudying(null); }}
                    >
                      Continue
                    </button>
                  </div>
                );
              })()
            ) : studying?.type === "CER" && (studying.meta as DeckCERMeta).mode === "Free Text" && cerFreeChecked ? (
              (() => {
                const allOk = (cerFreeOverride.claim === "right") && (cerFreeOverride.evidence === "right") && (cerFreeOverride.reasoning === "right");
                if (!cerFreeTrackedRef.current) {
                  cerFreeTrackedRef.current = true;
                  // CER free-text: apply rubric Claim 0.2 Evidence 0.4 Reasoning 0.4
                  const weights: Record<keyof typeof cerFreeOverride, number> = { claim: 0.2, evidence: 0.4, reasoning: 0.4 };
                  const keys = Object.keys(weights) as Array<keyof typeof cerFreeOverride>;
                  const totalWeight = keys.reduce((s, k) => s + weights[k], 0);
                  const score = keys.reduce((s, k) => s + ((cerFreeOverride[k] === "right") ? weights[k] : 0), 0);
                  const correctness = totalWeight > 0 ? score / totalWeight : (allOk ? 1 : 0);
                  const legacy = correctness >= 1 ? true : (correctness === 0 ? false : undefined);
                  trackAnswer({
                    cardId: (studying as DeckCER).id,
                    bloom: ((studying as DeckCER).bloomLevel as Bloom) || (defaultBloomForType((studying as DeckCER).type) as Bloom),
                    correctness,
                    correct: legacy,
                    responseMs: cerFreeResponseMs,
                    confidence: cerFreeConfidence,
                    guessed: cerFreeGuessed,
                    cardType: (studying as DeckCER).type,
                  }).catch(() => {});
                }
                return (
                  <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${allOk ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                    <div className="font-semibold">{allOk ? "Correct!" : "Not quite"}</div>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allOk ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}
                      onClick={() => { if (typeof onContinue === "function") onContinue(); else setStudying(null); }}
                    >
                      Continue
                    </button>
                  </div>
                );
              })()
            ) : studying?.type === "Compare/Contrast" && ccChecked && ccAllCorrect !== null ? (
              (() => {
                return (
                  <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${ccAllCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                    <div className="font-semibold">{ccAllCorrect ? "Correct!" : "Not quite"}</div>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-lg font-medium shadow-sm ${ccAllCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}
                      onClick={() => { if (typeof onContinue === "function") onContinue(); else setStudying(null); }}
                    >
                      Continue
                    </button>
                  </div>
                );
              })()
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
}

function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      className={`p-2 rounded-lg border transition-colors hover:bg-gray-100 ${danger ? "text-red-600 border-red-200 hover:bg-red-50" : "text-gray-700 border-gray-200"}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill={filled ? "#eab308" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

// Removed move up/down controls per spec
