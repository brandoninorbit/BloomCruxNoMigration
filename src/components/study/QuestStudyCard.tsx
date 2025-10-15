"use client";

import React, { useRef, useState, useEffect } from "react";
import type {
  DeckCard,
  DeckStandardMCQ,
  DeckFillMeta,
  DeckFillMetaV2,
  DeckFillMetaV3,
  DeckSequencingMeta,
  DeckShortAnswer,
  DeckSortingMeta,
  DeckCompareContrastMeta,
  DeckTwoTierMCQ,
  DeckCER,
  DeckCERPart,
} from "@/types/deck-cards";
import MCQStudy from "@/components/cards/MCQStudy";
import FillBlankStudy from "@/components/cards/FillBlankStudy";
import SequencingStudy from "@/components/cards/SequencingStudy";
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useDraggable, useSensor, useSensors, rectIntersection } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export type StudyAnswerEvent = {
  // Either boolean or fractional [0,1]
  correct?: boolean;
  correctness?: number;
  responseMs?: number;
  confidence?: 0 | 1 | 2 | 3;
  guessed?: boolean;
  payload?: Record<string, unknown>;
  cardType: string;
};

export default function QuestStudyCard({ card, onAnswer, onContinue }: { card: DeckCard; onAnswer: (ev: StudyAnswerEvent & { cardId: number }) => void; onContinue: () => void }) {
  // Simple switch to render a per-type UI that matches Quest styling/flow
  if (card.type === "Standard MCQ") {
    const mcq = card as DeckStandardMCQ;
    return (
      <MCQStudy
        key={card.id}
        prompt={mcq.question}
        options={[
          { key: "A", text: mcq.meta.options.A },
          { key: "B", text: mcq.meta.options.B },
          { key: "C", text: mcq.meta.options.C },
          { key: "D", text: mcq.meta.options.D },
        ]}
        answerKey={mcq.meta.answer}
        explanation={mcq.explanation}
        onAnswer={({ correct, chosen, responseMs, confidence, guessed }) => {
          onAnswer({ cardId: card.id, correct, responseMs, confidence, guessed, payload: { choice: chosen }, cardType: card.type });
        }}
        onContinue={onContinue}
      />
    );
  }

  if (card.type === "Fill in the Blank") {
    // Normalize V1/V2/V3 meta to FillBlankStudy props
    const meta = card.meta as DeckFillMeta;
    const isV2 = (m: DeckFillMeta): m is DeckFillMetaV2 => (m as DeckFillMetaV2).answers !== undefined && (m as DeckFillMetaV2).mode !== undefined;
    const isV3 = (m: DeckFillMeta): m is DeckFillMetaV3 => (m as DeckFillMetaV3).blanks !== undefined;
  const isV1 = (m: DeckFillMeta): m is { answer: string } => typeof (m as { answer?: unknown }).answer === "string";
    let stem = card.question;
    let blanks: { id: string | number; answers: string[]; hint?: string; mode?: "bank" | "free" | "either"; caseSensitive?: boolean; ignorePunct?: boolean }[] = [];
    let wordBank: string[] | undefined = undefined;
    if (isV3(meta)) {
      blanks = meta.blanks.map((b) => ({ id: b.id, answers: b.answers, hint: b.hint, mode: b.mode === "Drag & Drop" ? "bank" : b.mode === "Free Text" ? "free" : "either", caseSensitive: b.caseSensitive ?? meta.caseSensitive, ignorePunct: b.ignorePunct ?? meta.ignorePunct }));
      wordBank = meta.options;
      const tagRe = /\[\[(\d+)\]\]/g;
      const countTags = [...(stem.matchAll(tagRe))].length;
      if (countTags < blanks.length) {
        stem = `${stem}${Array.from({ length: blanks.length - countTags }, (_ , i) => ` [[${countTags + i + 1}]]`).join("")}`;
      }
    } else if (isV2(meta)) {
      const answers = meta.answers;
      const tagRe = /\[\[(\d+)\]\]/g;
      const existingTags = [...(stem.matchAll(tagRe))].length;
      if (existingTags < answers.length) {
        stem = `${stem}${Array.from({ length: answers.length - existingTags }, (_ , i) => ` [[${existingTags + i + 1}]]`).join("")}`;
      }
      blanks = answers.map((a, idx) => ({ id: String(idx + 1), answers: [a], mode: meta.mode === "Drag & Drop" ? "bank" : "free" }));
      wordBank = meta.options;
    } else if (isV1(meta)) {
      const legacy = (meta as unknown as { answer?: string })?.answer;
      if (legacy) {
        if (!/\[\[(\d+)\]\]/.test(stem)) stem = `${stem} [[1]]`;
        blanks = [{ id: "1", answers: [legacy] }];
      }
    }
    if ((!wordBank || wordBank.length === 0) && isV3(meta) && (meta.mode === "Either" || meta.mode === "Drag & Drop")) {
      const uniq = new Set<string>();
      blanks.forEach((b) => b.answers.forEach((a) => uniq.add(a)));
      wordBank = Array.from(uniq);
    }
    return (
      <FillBlankStudy
        key={card.id}
        stem={stem}
        blanks={blanks}
        wordBank={wordBank}
        explanation={(card as DeckCard).explanation}
        onAnswer={({ perBlank, allCorrect, filledText, responseMs, confidence, guessed }) => {
          const total = blanks.length || 1;
          const numCorrect = Object.values(perBlank).filter(Boolean).length;
          const correctness = total ? numCorrect / total : (allCorrect ? 1 : 0);
          onAnswer({ cardId: card.id, correct: allCorrect, correctness, responseMs, confidence, guessed, payload: { perBlank, filledText }, cardType: card.type });
        }}
        onContinue={onContinue}
      />
    );
  }

  if (card.type === "Sequencing") {
    const seq = card as { question: string; meta: DeckSequencingMeta };
    return (
      <SequencingStudy
        key={card.id}
        prompt={seq.question}
        steps={seq.meta.steps}
        explanation={(card as DeckCard).explanation}
        onAnswer={({ wrongIndexes, allCorrect, responseMs, confidence, guessed }) => {
          const total = seq.meta.steps.length;
          const numCorrect = total && wrongIndexes ? Math.max(0, total - wrongIndexes.length) : (allCorrect ? total : 0);
          const correctness = total ? numCorrect / total : (allCorrect ? 1 : 0);
          onAnswer({ cardId: card.id, correct: allCorrect, correctness, responseMs, confidence, guessed, cardType: card.type });
        }}
        onContinue={onContinue}
      />
    );
  }

  if (card.type === "Short Answer") {
    return <ShortAnswerQuest key={card.id} card={card as DeckShortAnswer} onAnswer={onAnswer} onContinue={onContinue} />;
  }

  if (card.type === "Sorting") {
    return <SortingQuest key={card.id} card={card as DeckCard & { type: "Sorting"; meta: DeckSortingMeta }} onAnswer={onAnswer} onContinue={onContinue} />;
  }

  if (card.type === "Two-Tier MCQ") {
    return <TwoTierQuest key={card.id} card={card as DeckTwoTierMCQ} onAnswer={onAnswer} onContinue={onContinue} />;
  }

  if (card.type === "CER") {
    return <CERQuest key={card.id} card={card as DeckCER} onAnswer={onAnswer} onContinue={onContinue} />;
  }

  if (card.type === "Compare/Contrast") {
    return <CompareContrastQuest key={card.id} card={card as DeckCard & { type: "Compare/Contrast"; meta: DeckCompareContrastMeta }} onAnswer={onAnswer} onContinue={onContinue} />;
  }

  return null;
}

function ShortAnswerQuest({ card, onAnswer, onContinue }: { card: DeckShortAnswer; onAnswer: (ev: StudyAnswerEvent & { cardId: number }) => void; onContinue: () => void }) {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const [judged, setJudged] = useState<null | "yes" | "no">(null);
  const [confidence, setConfidence] = useState<0 | 1 | 2 | 3 | undefined>(undefined);
  const [guessed, setGuessed] = useState(false);
  const startRef = useRef<number>(Date.now());
  const responseMs = () => Date.now() - startRef.current;

  useEffect(() => {
    setText("");
    setChecked(false);
    setJudged(null);
    setConfidence(undefined);
    setGuessed(false);
    startRef.current = Date.now();
  }, [card.id]);

  function reveal() {
    if (!checked) setChecked(true);
  }
  function mark(correct: boolean) {
    setJudged(correct ? "yes" : "no");
    onAnswer({ cardId: card.id, correct, responseMs: responseMs(), confidence, guessed, cardType: card.type });
  }
  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
      <textarea
        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        rows={4}
        placeholder="Type your answer..."
        value={text}
        onChange={(e) => { if (!checked) setText(e.target.value); }}
        readOnly={checked}
      />
      {!checked && (
        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm text-slate-600" htmlFor="sa-confidence">Confidence</label>
          <select id="sa-confidence" value={confidence ?? ""} onChange={(e) => setConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
            <option value="">-</option>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} />Guessed</label>
        </div>
      )}
      <div className="mt-4">
        {!checked ? (
          <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" onClick={reveal} disabled={text.trim().length === 0}>Check Answer</button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="font-semibold text-slate-900 mb-1">Suggested answer</div>
              <div className="text-slate-800 font-semibold">{card.meta.suggestedAnswer || "No suggested answer."}</div>
              {card.explanation ? <div className="mt-3 text-sm text-slate-600">{card.explanation}</div> : null}
            </div>
            {judged == null ? (
              <div className="flex items-center justify-between">
                <div className="text-slate-700 font-medium">Did you get it right?</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => mark(true)} className="group inline-flex items-center gap-2 rounded-lg border border-green-500 px-3 py-2 text-green-600 hover:bg-green-500 hover:text-white transition-colors">
                    <svg className="h-5 w-5 text-green-600 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Yes
                  </button>
                  <button type="button" onClick={() => mark(false)} className="group inline-flex items-center gap-2 rounded-lg border border-red-500 px-3 py-2 text-red-600 hover:bg-red-500 hover:text-white transition-colors">
                    <svg className="h-5 w-5 text-red-600 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    No
                  </button>
                </div>
              </div>
            ) : (
              <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${judged === "yes" ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                <div className="font-semibold">{judged === "yes" ? "Correct!" : "Not quite"}</div>
                <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${judged === "yes" ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={onContinue}>Continue</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SortingQuest({ card, onAnswer, onContinue }: { card: DeckCard & { type: "Sorting"; meta: DeckSortingMeta }; onAnswer: (ev: StudyAnswerEvent & { cardId: number }) => void; onContinue: () => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // term -> category
  const [checked, setChecked] = useState(false);
  const [showCorrect, setShowCorrect] = useState(false);
  const [allCorrect, setAllCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    setAssignments({});
    setChecked(false);
    setShowCorrect(false);
    setAllCorrect(null);
  }, [card.id]);

  const categories = card.meta.categories;
  const items = card.meta.items.map((it) => it.term);

  function DraggableChip({ id, text }: { id: string; text: string }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
    const style: React.CSSProperties = { transform: CSS.Translate.toString(transform) };
    // After check, color by correctness
    let chipClass = "";
    if (checked) {
      const correctByTerm: Record<string, string> = {};
      for (const it of card.meta.items) correctByTerm[it.term] = it.correctCategory;
      const cat = assignments[text];
      const ok = cat && cat === correctByTerm[text];
      if (showCorrect) {
        chipClass = "bg-green-200 border-green-400 text-green-900"; // darker green for correct placement
      } else {
        chipClass = ok ? "bg-green-50 border-green-300 text-green-800" : "bg-red-50 border-red-300 text-red-800";
      }
    }
    return (
      <div ref={setNodeRef} style={style} className={`px-2 py-1 rounded border text-sm shadow-sm ${chipClass || "bg-white"} ${checked ? "opacity-70" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-75 dragging" : ""}`} {...(!checked ? { ...attributes, ...listeners } : {})}>
        {text}
      </div>
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
    const correctByTerm: Record<string, string> = {};
    for (const it of card.meta.items) correctByTerm[it.term] = it.correctCategory;
    const total = items.length || 1;
    const numCorrect = items.filter((t) => assignments[t] && assignments[t] === correctByTerm[t]).length;
    const correctness = Math.max(0, Math.min(1, numCorrect / total));
    setChecked(true);
    setAllCorrect(correctness === 1);
    onAnswer({ cardId: card.id, correctness, correct: correctness === 1, cardType: card.type });
  };

  const revealCorrect = () => {
    const correctByTerm: Record<string, string> = {};
    for (const it of card.meta.items) correctByTerm[it.term] = it.correctCategory;
    setAssignments(correctByTerm);
    setShowCorrect(true);
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat) => (
            <DropZone key={cat} id={`cat:${cat}`} title={cat}>
              {tokensInCategory(cat).map((t) => <DraggableChip key={t} id={t} text={t} />)}
            </DropZone>
          ))}
          <DropZone id="unsorted" title="Unsorted">
            {unsorted.map((t) => <DraggableChip key={t} id={t} text={t} />)}
          </DropZone>
        </div>
      </DndContext>
      {!checked ? (
        <div className="mt-4"><button type="button" className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={checkNow}>Check</button></div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!showCorrect ? <button type="button" className="px-3 py-2 rounded border border-slate-300" onClick={revealCorrect}>Show correct</button> : <span className="text-sm text-slate-600">Correct answers highlighted.</span>}
            </div>
            <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${allCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
              <div className="font-semibold">{allCorrect ? "Correct!" : "Not quite"}</div>
              <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={onContinue}>Continue</button>
            </div>
          </div>
          {checked && card.explanation ? (
            <div className="rounded-lg bg-slate-50 p-4 text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">Explanation</div>
              <div className="text-sm leading-relaxed">{card.explanation}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TwoTierQuest({ card, onAnswer, onContinue }: { card: DeckTwoTierMCQ; onAnswer: (ev: StudyAnswerEvent & { cardId: number }) => void; onContinue: () => void }) {
  const [tier1, setTier1] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [tier2, setTier2] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [guessed, setGuessed] = useState(false);
  const startRef = useRef<number>(Date.now());
  const meta = card.meta;

  useEffect(() => {
    setTier1(null);
    setTier2(null);
    setChecked(false);
    setConfidence(undefined);
    setGuessed(false);
    startRef.current = Date.now();
  }, [card.id]);

  const onPick = (tier: 1 | 2, k: "A" | "B" | "C" | "D") => {
    if (checked) return;
    if (tier === 1) { if (tier1 != null) return; setTier1(k); } else { if (tier2 != null) return; setTier2(k); setChecked(true); }
  };

  const renderTier = (label: string, options: { A: string; B: string; C: string; D: string }, answer: "A"|"B"|"C"|"D", picked: "A"|"B"|"C"|"D"|null, disabled: boolean, onChoose: (k: "A"|"B"|"C"|"D") => void, extraQuestion?: string) => (
    <div className="w-full">
      <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
      {extraQuestion ? (
        <div className="mb-2 text-slate-800 font-medium">{extraQuestion}</div>
      ) : null}
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

  React.useEffect(() => {
    if (checked) {
      onAnswer({ cardId: card.id, correctness, correct: correctness === 1 ? true : (correctness === 0 ? false : undefined), responseMs: Date.now() - startRef.current, confidence, guessed, cardType: card.type });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

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
      {renderTier("Tier 2", meta.tier2.options, meta.tier2.answer, tier2, checked || tier2 != null, (k) => onPick(2, k), meta.tier2.question)}
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

function CERQuest({ card, onAnswer, onContinue }: { card: DeckCER; onAnswer: (ev: StudyAnswerEvent & { cardId: number }) => void; onContinue: () => void }) {
  // Support both CER modes: Multiple Choice (per-part) and Free Text with suggested answers + self-mark
  const meta = card.meta as DeckCER["meta"];
  const [mcqSel, setMcqSel] = useState<{ claim: number | null; evidence: number | null; reasoning: number | null }>({ claim: null, evidence: null, reasoning: null });
  const [mcqChecked, setMcqChecked] = useState(false);
  const [mcqConfidence, setMcqConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [mcqGuessed, setMcqGuessed] = useState(false);
  const mcqStartRef = useRef<number>(Date.now());

  const [ftText, setFtText] = useState<{ claim: string; evidence: string; reasoning: string }>({ claim: "", evidence: "", reasoning: "" });
  const [ftChecked, setFtChecked] = useState(false);
  const [ftOverride, setFtOverride] = useState<{ claim?: "right" | "wrong"; evidence?: "right" | "wrong"; reasoning?: "right" | "wrong" }>({});
  const [ftConfidence, setFtConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [ftGuessed, setFtGuessed] = useState(false);
  const ftStartRef = useRef<number>(Date.now());

  useEffect(() => {
    setMcqSel({ claim: null, evidence: null, reasoning: null });
    setMcqChecked(false);
    setMcqConfidence(undefined);
    setMcqGuessed(false);
    mcqStartRef.current = Date.now();

    setFtText({ claim: "", evidence: "", reasoning: "" });
    setFtChecked(false);
    setFtOverride({});
    setFtConfidence(undefined);
    setFtGuessed(false);
    ftStartRef.current = Date.now();
  }, [card.id]);

  const partKeys = ["claim", "evidence", "reasoning"] as const;
  type CERMCQ = Extract<DeckCERPart, { options: string[]; correct: number }>;
  type CERFree = Extract<DeckCERPart, { sampleAnswer?: string }>;
  const isMCQPart = (p: DeckCERPart): p is CERMCQ => typeof (p as CERMCQ).correct === "number" && Array.isArray((p as CERMCQ).options);
  const sampleFor = (p: DeckCERPart): string | undefined => {
    if (isMCQPart(p)) return undefined;
    return (p as CERFree).sampleAnswer;
  };

  // MCQ mode scoring
  const mcqParts = partKeys.map((k) => ({ key: k, info: isMCQPart(meta[k]) ? (meta[k] as { options: string[]; correct: number }) : undefined }));
  const mcqTotal = Math.max(1, mcqParts.filter((p) => p.info).length);
  const mcqNumCorrect = mcqParts.reduce((sum, p) => {
    if (!p.info) return sum;
    const picked = mcqSel[p.key];
    return sum + (picked != null && picked === p.info.correct ? 1 : 0);
  }, 0);
  const mcqCorrectness = mcqChecked ? Math.max(0, Math.min(1, mcqNumCorrect / mcqTotal)) : undefined;

  React.useEffect(() => {
    if (mcqChecked) {
      onAnswer({ cardId: card.id, correctness: mcqCorrectness, correct: mcqCorrectness === 1 ? true : (mcqCorrectness === 0 ? false : undefined), responseMs: Date.now() - mcqStartRef.current, confidence: mcqConfidence, guessed: mcqGuessed, cardType: card.type });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcqChecked]);

  // Free-text mode scoring (self-marked). Score = (# parts marked "right") / 3
  const ftTotal = 3;
  const ftNumRight = (ftOverride.claim === "right" ? 1 : 0) + (ftOverride.evidence === "right" ? 1 : 0) + (ftOverride.reasoning === "right" ? 1 : 0);
  const ftCorrectness = ftChecked ? Math.max(0, Math.min(1, ftNumRight / ftTotal)) : undefined;

  React.useEffect(() => {
    if (ftChecked) {
      onAnswer({ cardId: card.id, correctness: ftCorrectness, correct: ftCorrectness === 1 ? true : (ftCorrectness === 0 ? false : undefined), responseMs: Date.now() - ftStartRef.current, confidence: ftConfidence, guessed: ftGuessed, cardType: card.type });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ftChecked]);

  const guidance = meta.guidanceQuestion;

  if (meta.mode === "Multiple Choice") {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-semibold mb-1 text-slate-900">{card.question}</h2>
        {guidance ? <div className="mb-3 text-base font-semibold text-slate-700">{guidance}</div> : null}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mcqParts.map((p) => {
            const label = p.key[0]!.toUpperCase() + p.key.slice(1);
            const info = p.info;
            if (!info) {
              return (
                <div key={p.key} className="w-full">
                  <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
                  <div className="text-xs text-slate-500">Free text</div>
                </div>
              );
            }
            const picked = mcqSel[p.key];
            return (
              <div key={p.key} className="w-full">
                <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
                <div className="grid grid-cols-1 gap-2">
                  {info.options.map((text, idx) => {
                    let classes = "border-slate-200 hover:bg-slate-50";
                    if (mcqChecked) {
                      const isCorrect = idx === info.correct;
                      const isWrongChosen = picked === idx && !isCorrect;
                      if (isCorrect) classes = "border-green-500 bg-green-50";
                      if (isWrongChosen) classes = "border-red-500 bg-red-50";
                    } else if (picked === idx) {
                      classes = "border-blue-500 bg-blue-50";
                    }
                    return (
                      <button key={idx} type="button" disabled={mcqChecked} onClick={() => setMcqSel((prev) => ({ ...prev, [p.key]: idx }))} className={`text-left rounded-lg border px-4 py-3 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${classes}`}>
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-slate-700">{String.fromCharCode(65 + idx)}.</span>
                          <span className="text-slate-800">{text}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {!mcqChecked ? (
          <div className="mt-4"><button type="button" className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={() => setMcqChecked(true)}>Check</button></div>
        ) : (
          <div className="mt-4 flex items-center justify-end"><button type="button" className="px-4 py-2 rounded-lg font-medium bg-slate-900 text-white" onClick={onContinue}>Continue</button></div>
        )}
      </div>
    );
  }

  // Free Text mode UI
  const partsFT: Array<{ key: keyof typeof ftText; label: string; sample?: string }> = [
    { key: "claim", label: "Claim", sample: sampleFor(meta.claim) },
    { key: "evidence", label: "Evidence", sample: sampleFor(meta.evidence) },
    { key: "reasoning", label: "Reasoning", sample: sampleFor(meta.reasoning) },
  ];

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-1 text-slate-900">{card.question}</h2>
      {guidance ? <div className="mb-3 text-base font-semibold text-slate-700">{guidance}</div> : null}
      {!ftChecked ? (
        <div className="mb-3 flex items-center gap-3">
          <label className="text-sm text-slate-600">Confidence</label>
          <select value={ftConfidence ?? ""} onChange={(e) => setFtConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
            <option value="">-</option>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={ftGuessed} onChange={(e) => setFtGuessed(e.target.checked)} />Guessed</label>
        </div>
      ) : null}
      <div className="space-y-4">
        {partsFT.map((p) => (
          <div key={p.key as string} className="rounded-lg border border-slate-200 p-3 bg-white">
            <div className="text-sm font-semibold text-slate-800 mb-2">{p.label}</div>
            <textarea
              className={`w-full rounded-lg border p-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${ftChecked ? ((ftOverride[p.key] === "right") ? "border-green-500" : "border-red-500") : "border-slate-300"}`}
              rows={3}
              placeholder={`Write your ${p.label.toLowerCase()}...`}
              value={ftText[p.key]}
              onChange={(e) => !ftChecked && setFtText((prev) => ({ ...prev, [p.key]: e.target.value }))}
              readOnly={ftChecked}
            />
            {ftChecked ? (
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="flex-1 text-sm text-slate-700">
                  <div className="font-medium text-slate-900 mb-1">Sample answer</div>
                  <div className="text-slate-700">{p.sample || "No sample answer provided."}</div>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <button type="button" className="px-2 py-1 rounded-md border border-green-500 text-green-600 hover:bg-green-50 text-xs" onClick={() => setFtOverride((prev) => ({ ...prev, [p.key]: "right" }))}>I was right</button>
                  <button type="button" className="px-2 py-1 rounded-md border border-red-500 text-red-600 hover:bg-red-50 text-xs" onClick={() => setFtOverride((prev) => ({ ...prev, [p.key]: "wrong" }))}>I was wrong</button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {!ftChecked ? (
        <div className="mt-4">
          <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" onClick={() => setFtChecked(true)} disabled={!(ftText.claim || ftText.evidence || ftText.reasoning)}>
            Check Answers
          </button>
        </div>
      ) : null}
      {ftChecked ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${ftCorrectness === 1 ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
          <div className="font-semibold">{ftCorrectness === 1 ? "Correct!" : "Not quite"}</div>
          <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${ftCorrectness === 1 ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={onContinue}>Continue</button>
        </div>
      ) : null}
      {ftChecked && card.explanation ? (
        <div className="mt-3 text-sm text-slate-600">{card.explanation}</div>
      ) : null}
    </div>
  );
}

function CompareContrastQuest({ card, onAnswer, onContinue }: { card: DeckCard & { type: "Compare/Contrast"; meta: DeckCompareContrastMeta }; onAnswer: (ev: StudyAnswerEvent & { cardId: number }) => void; onContinue: () => void }) {
  const meta = card.meta;
  const itemA = meta.itemA;
  const itemB = meta.itemB;
  const rows = meta.points || [];

  const [ccA, setCcA] = useState<Record<number, string>>({});
  const [ccB, setCcB] = useState<Record<number, string>>({});
  const [ccChecked, setCcChecked] = useState(false);
  const [ccOverride, setCcOverride] = useState<Record<number, "right" | "wrong" | undefined>>({});
  const [ccAllCorrect, setCcAllCorrect] = useState<boolean | null>(null);
  const [ccConfidence, setCcConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [ccGuessed, setCcGuessed] = useState(false);
  const startRef = useRef<number>(Date.now());
  const aRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const bRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    setCcA({});
    setCcB({});
    setCcChecked(false);
    setCcOverride({});
    setCcAllCorrect(null);
    setCcConfidence(undefined);
    setCcGuessed(false);
    startRef.current = Date.now();
  }, [card.id]);

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
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    const dist = dp[n][m];
    const maxLen = Math.max(n, m);
    return maxLen > 0 ? 1 - dist / maxLen : 1;
  };
  const similarity = (a: string, b: string) => Math.max(jaccard(a, b), levenshteinRatio(a, b));
  const fuzzyEqual = (user: string, expected: string, threshold = 0.72) => similarity(user, expected) >= threshold;

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

  const checkNow = () => {
    const all = rows.every((_, idx) => effectiveRowCorrect(idx));
    setCcAllCorrect(all);
    setCcChecked(true);
    const total = rows.length;
    let numCorrect = 0;
    for (let i = 0; i < rows.length; i++) if (effectiveRowCorrect(i)) numCorrect++;
    const correctness = total ? numCorrect / total : (all ? 1 : 0);
    onAnswer({ cardId: card.id, correctness, correct: correctness === 1 ? true : (correctness === 0 ? false : undefined), responseMs: Date.now() - startRef.current, confidence: ccConfidence, guessed: ccGuessed, cardType: card.type });

    // resize textareas to fit content after revealing
    requestAnimationFrame(() => {
      const resizeMap = (map: Record<number, HTMLTextAreaElement | null>) => {
        Object.values(map).forEach((el) => {
          if (!el) return;
          el.style.height = "auto";
          el.style.overflow = "hidden";
          el.style.height = `${el.scrollHeight}px`;
        });
      };
      resizeMap(aRefs.current);
      resizeMap(bRefs.current);
    });
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
                          ref={(el) => { aRefs.current[idx] = el; }}
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
                          ref={(el) => { bRefs.current[idx] = el; }}
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
      {ccChecked ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${ccAllCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
          <div className="font-semibold">{ccAllCorrect ? "Correct!" : "Not quite"}</div>
          <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${ccAllCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={onContinue}>Continue</button>
        </div>
      ) : null}
    </div>
  );
}
