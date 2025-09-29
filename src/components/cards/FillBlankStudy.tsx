"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { playCorrectSound, triggerDeferredCorrect } from "@/lib/audio";
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useDraggable, useSensor, useSensors, rectIntersection } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export type BlankSpec = {
  id: string | number;
  answers: string[];
  hint?: string;
  mode?: "bank" | "free" | "either";
  caseSensitive?: boolean;
  ignorePunct?: boolean;
};

type Props = {
  stem: string; // "... [[1]] ... [[2]] ..."
  blanks: BlankSpec[];
  wordBank?: string[];
  explanation?: string;
  submitLabel?: string;
  onAnswer: (result: { perBlank: Record<string | number, boolean>; allCorrect: boolean; filledText: string; mode: "auto"; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean }) => void;
  onContinue?: () => void;
};

function normalize(s: string, caseSensitive?: boolean, ignorePunct?: boolean) {
  let t = s.trim();
  if (!caseSensitive) t = t.toLowerCase();
  if (ignorePunct) t = t.replace(/[\p{P}\p{S}]/gu, "");
  return t;
}

function Token({ id, text, disabled }: { id: string; text: string; disabled?: boolean }) {
  // Always call the hook to preserve hook ordering. When disabled we just don't attach the drag refs/props.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style: React.CSSProperties = { transform: CSS.Translate.toString(transform) };
  if (disabled) {
    return (
      <div className="px-2 py-1 rounded border text-sm bg-white shadow-sm opacity-80 cursor-default">
        {text}
      </div>
    );
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`px-2 py-1 rounded border text-sm bg-white shadow-sm cursor-grab active:cursor-grabbing ${isDragging ? "opacity-75 dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      {text}
    </div>
  );
}

function BlankSlot({
  id,
  value,
  onInput,
  isDroppable,
  placeholder,
  showClear,
  onClear,
  label,
  hasError,
  mode,
  checked,
  override,
  onOverride,
  onConfirmRight,
  correctAnswer,
  showCorrect,
}: {
  id: string;
  value: string;
  onInput?: (v: string) => void;
  isDroppable: boolean;
  placeholder: string;
  showClear: boolean;
  onClear: () => void;
  label: string;
  hasError?: boolean;
  mode: "bank" | "free" | "either";
  checked?: boolean;
  override?: "right" | "wrong";
  onOverride?: (ov: "right" | "wrong") => void;
  onConfirmRight?: () => void;
  correctAnswer?: string;
  showCorrect?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const cls = `inline-flex items-center gap-1 min-w-[64px] px-2 py-1 rounded border align-middle mx-1 ${
    isOver ? "droppable-over" : hasError ? "border-red-400 bg-red-50" : "bg-yellow-50 border-dashed"
  }`;
  const showValueError = Boolean(hasError && value);
  const valueCls = showValueError ? "rounded px-1 bg-red-100 text-red-700 border border-red-200" : undefined;
  const inputCls = `bg-transparent outline-none w-24 ${showValueError ? "bg-red-50 text-red-700 border border-red-300 rounded px-1" : ""}`;
  const commonA11y = { role: "textbox", "aria-label": label, "aria-dropeffect": isDroppable ? "move" : undefined } as const;
  return (
    <span
      ref={isDroppable ? setNodeRef : undefined}
      className={cls}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Backspace" || e.key === "Delete") && value) onClear();
      }}
      {...commonA11y}
    >
      {mode !== "bank" ? (
        checked ? (
          <>
            <span className={inputCls}>{value}</span>
            {correctAnswer ? <span className="text-green-700 ml-1">(correct: {correctAnswer})</span> : null}
          </>
        ) : (
          <input
            value={value}
            onChange={(e) => onInput?.(e.target.value)}
            className={inputCls}
            placeholder={placeholder}
          />
        )
      ) : (
        <span className={valueCls}>{value || placeholder}</span>
      )}
      {showClear && (
        <button aria-label={`Clear ${label}`} className="font-valid text-slate-500 hover:text-slate-700" onClick={onClear} type="button">
          ×
        </button>
      )}
      {checked && override === undefined && onOverride ? (
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            className="px-1 py-0.5 rounded text-xs border border-green-500 text-green-600 hover:bg-green-50"
      onClick={() => { onOverride("right"); onConfirmRight?.(); }}
          >
            I was right
          </button>
          <button
            type="button"
            className="px-1 py-0.5 rounded text-xs border border-red-500 text-red-600 hover:bg-red-50"
            onClick={() => onOverride("wrong")}
          >
            I was wrong
          </button>
        </div>
      ) : null}
      {checked && correctAnswer && (override === "wrong" || showCorrect) && mode !== "free" ? (
        <div className="mt-1 text-xs text-green-700">
          <span className="font-semibold">Correct:</span> {correctAnswer}
        </div>
      ) : null}
    </span>
  );
}

export default function FillBlankStudy({ stem, blanks, wordBank, explanation, submitLabel = "Submit answer", onAnswer, onContinue }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [placements, setPlacements] = useState<Record<string | number, string>>({});
  const [bank, setBank] = useState<string[]>(() => [...(wordBank ?? [])]);
  const [checked, setChecked] = useState(false);
  const [perBlank, setPerBlank] = useState<Record<string | number, boolean>>({});
  const [perBlankOverride, setPerBlankOverride] = useState<Record<string | number, "right" | "wrong" | undefined>>({});
  const [showCorrect, setShowCorrect] = useState(false);
  const [confidence, setConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [guessed, setGuessed] = useState(false);
  const startRef = React.useRef<number>(Date.now());

  // Check if there are any free text blanks
  const hasFreeText = blanks.some(b => b.mode === "free");

  // Keys to detect content changes from props
  const propBankKey = useMemo(() => (wordBank ?? []).join(","), [wordBank]);
  const blanksKey = useMemo(() => JSON.stringify(blanks), [blanks]);
  useEffect(() => {
    // Reset all transient state whenever the card content changes
    setChecked(false);
    setPerBlank({});
    setShowCorrect(false);
    setConfidence(undefined);
    setGuessed(false);
    setPlacements({});
    // Replace bank from incoming props so we don't leak the prior card's tokens
    setBank([...(wordBank ?? [])]);
    startRef.current = Date.now();
  }, [stem, blanksKey, propBankKey, wordBank]);

  useEffect(() => {
    if (!checked) return;
    setPerBlank(prevPerBlank => {
      const updatedPer: Record<string | number, boolean> = {};
      for (const b of blanks) {
        const ov = perBlankOverride[b.id];
        if (ov === "right") updatedPer[b.id] = true;
        else if (ov === "wrong") updatedPer[b.id] = false;
        else updatedPer[b.id] = prevPerBlank[b.id] ?? true; // for auto-graded
      }
      return updatedPer;
    });
  }, [perBlankOverride, checked, blanks]);
  // Support legacy __n__ markers by normalizing them to [[n]]
  const normalizedStem = useMemo(() => stem.replace(/__(\d+)__/g, "[[$1]]"), [stem]);
  const parts = useMemo(() => normalizedStem.split(/\[\[(\d+)\]\]/g), [normalizedStem]);
  const correctMap = useMemo(() => {
    const m: Record<string | number, string> = {};
    for (const b of blanks) {
      if (b.answers && b.answers.length > 0) m[b.id] = b.answers[0];
    }
    return m;
  }, [blanks]);

  const buildFilledText = useCallback(() => {
    // Reconstruct stem by replacing [[n]] with value
    return stem.replace(/\[\[(\d+)\]\]/g, (_m, g1) => placements[g1] ?? "");
  }, [stem, placements]);

  useEffect(() => {
    if (!checked) return;
    const allCorrect = Object.values(perBlank).every(Boolean);
    const responseMs = Date.now() - startRef.current;
    onAnswer({ perBlank, allCorrect, filledText: buildFilledText(), mode: "auto", responseMs, confidence, guessed });
  }, [perBlank, checked, buildFilledText, confidence, guessed, onAnswer]);

  const dropInto = (id: string | number, value: string) => {
    setPlacements((prev) => {
      const existing = prev[id];
      const next: Record<string | number, string> = { ...prev, [id]: value };
      setBank((prevBank) => {
        const withoutDragged = prevBank.filter((t) => t !== value);
        return existing ? [...withoutDragged, existing] : withoutDragged;
      });
      return next;
    });
  };

  const onDragStart = () => {
    document.documentElement.classList.add("dragging");
  };
  const onDragCancel = () => {
    document.documentElement.classList.remove("dragging");
  };
  const onDragEnd = (e: DragEndEvent) => {
    document.documentElement.classList.remove("dragging");
    const tokenId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : undefined;
    const value = bank.find((t) => t === tokenId);
    if (overId && value) {
      dropInto(overId, value);
    }
  };

  const checkNow = () => {
    const nextPer: Record<string | number, boolean> = {};
    const nextOverride: Record<string | number, "right" | "wrong" | undefined> = {};
    for (const b of blanks) {
      const val = placements[b.id] ?? "";
  // Always attempt auto-grade (even for free/either) so user gets immediate feedback.
  // Trim/normalize based on per-blank settings.
  const good = val.length > 0 && b.answers.some((a) => normalize(a, b.caseSensitive, b.ignorePunct) === normalize(val, b.caseSensitive, b.ignorePunct));
  nextPer[b.id] = good;
  // Leave override undefined so the "I was right / I was wrong" buttons appear for all blanks,
  // allowing user to correct auto-grader (e.g., synonyms, alternate phrasing).
  nextOverride[b.id] = undefined;
    }
    setPerBlank(nextPer);
    setPerBlankOverride(nextOverride);
    setChecked(true);
    setShowCorrect(false);
    const allCorrect = Object.values(nextPer).every(Boolean);
    const responseMs = Date.now() - startRef.current;
    onAnswer({ perBlank: nextPer, allCorrect, filledText: buildFilledText(), mode: "auto", responseMs, confidence, guessed });
    if (allCorrect) {
      // Defer playback until user confirms any overrides ("I was right").
      playCorrectSound({ defer: true });
    }
  };

  return (
    <div className="w-full max-w-3xl">
      <div className="prose prose-slate">
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragCancel={onDragCancel} onDragEnd={onDragEnd} collisionDetection={rectIntersection}>
          <div>
            {parts.map((p, i) => {
              if (i % 2 === 1) {
                const id = parts[i];
                const spec = blanks.find((b) => String(b.id) === String(id));
                const mode = spec?.mode ?? "either";
                const val = placements[id] ?? "";
                const shown = showCorrect ? (correctMap[id] ?? val) : val;
                const droppable = !showCorrect && !checked && mode !== "free"; // disable after submit
                const handler = showCorrect || checked ? undefined : mode === "bank" ? undefined : (v: string) => setPlacements((prev) => ({ ...prev, [id]: v }));
                const label = `Blank ${id}`;
                const hasError = checked && !showCorrect ? !perBlank[id] : false;
        const showClear = !showCorrect && !checked && Boolean(val);
                return (
                  <BlankSlot
                    key={i}
                    id={id}
                    value={shown}
                    onInput={handler}
                    isDroppable={droppable}
                    placeholder={`[[${id}]]`}
                    showClear={showClear}
                    onClear={() => {
                      setPlacements((prev) => ({ ...prev, [id]: "" }));
                      setBank((prev) => (val ? [...prev.filter((t) => t !== val), val] : prev));
                    }}
                    label={label}
                    hasError={hasError}
                    mode={mode}
                    checked={checked}
                    override={perBlankOverride[id]}
                    onOverride={(ov) => setPerBlankOverride((prev) => ({ ...prev, [id]: ov }))}
                    onConfirmRight={() => {
                      // After user confirms one blank, if all blanks are correct (taking overrides) play.
                      const updated = { ...perBlank, [id]: true };
                      const nowAll = Object.values(updated).every(Boolean);
                      if (nowAll) triggerDeferredCorrect();
                    }}
                    correctAnswer={correctMap[id]}
                    showCorrect={showCorrect}
                  />
                );
              }
              return <span key={i}>{p}</span>;
            })}
          </div>
          {bank.length > 0 && !showCorrect && (
            <div className="mt-4">
              <p className="font-valid text-sm text-slate-500 mb-2">Word bank</p>
              <div className="flex flex-wrap gap-2">{bank.map((t) => (<Token key={t} id={t} text={t} disabled={checked} />))}</div>
            </div>
          )}
        </DndContext>
      </div>
  <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="fib-confidence" className="text-sm text-slate-600">Confidence</label>
          <select id="fib-confidence" value={confidence ?? ""} onChange={(e) => setConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
            <option value="">-</option>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <label className="ml-2 text-sm"><input type="checkbox" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} className="mr-1"/>Guessed</label>
        </div>
        {!checked ? (
          <button className="font-valid px-4 py-2 rounded-xl bg-blue-600 text-white" onClick={checkNow}>{submitLabel}</button>
        ) : null}
        {checked && !hasFreeText ? (
          <button
            type="button"
            className="font-valid px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={() => setShowCorrect((v) => !v)}
          >
            {showCorrect ? "Show my placement" : "Show correct placement"}
          </button>
        ) : null}
        {checked && explanation ? <span className="text-sm text-slate-600">{explanation}</span> : null}
      </div>
      {checked ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${Object.values(perBlank).every(Boolean) ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
          <div className="font-semibold">{Object.values(perBlank).every(Boolean) ? "Correct!" : "Not quite"}</div>
          <div className="flex items-center gap-2">
            <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${Object.values(perBlank).every(Boolean) ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={() => { if (typeof onContinue === 'function') onContinue(); else setShowCorrect(false); }}>
              Continue
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
