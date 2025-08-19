"use client";
import React, { useEffect, useMemo, useState } from "react";
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
  selfCheck?: boolean;
  submitLabel?: string;
  onAnswer: (result: { perBlank: Record<string | number, boolean>; allCorrect: boolean; filledText: string; mode: "auto" }) => void;
};

function normalize(s: string, caseSensitive?: boolean, ignorePunct?: boolean) {
  let t = s.trim();
  if (!caseSensitive) t = t.toLowerCase();
  if (ignorePunct) t = t.replace(/[\p{P}\p{S}]/gu, "");
  return t;
}

function Token({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style: React.CSSProperties = { transform: CSS.Translate.toString(transform) };
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
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const cls = `inline-flex items-center gap-1 min-w-[64px] px-2 py-1 rounded border align-middle mx-1 ${
    isOver ? "droppable-over" : hasError ? "border-red-400 bg-red-50" : "bg-yellow-50 border-dashed"
  }`;
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
        <input
          value={value}
          onChange={(e) => onInput?.(e.target.value)}
          className="bg-transparent outline-none w-24"
          placeholder={placeholder}
        />
      ) : (
        <span>{value || placeholder}</span>
      )}
      {showClear && (
        <button aria-label={`Clear ${label}`} className="font-valid text-slate-500 hover:text-slate-700" onClick={onClear} type="button">
          ×
        </button>
      )}
    </span>
  );
}

export default function FillBlankStudy({ stem, blanks, wordBank, explanation, selfCheck, submitLabel = "Check Answer", onAnswer }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [placements, setPlacements] = useState<Record<string | number, string>>({});
  const [bank, setBank] = useState<string[]>(() => [...(wordBank ?? [])]);
  const [checked, setChecked] = useState(false);
  const [perBlank, setPerBlank] = useState<Record<string | number, boolean>>({});

  const bankKey = bank.join(",");
  useEffect(() => {
    // Reset check state when content changes
    setChecked(false);
    setPerBlank({});
  }, [stem, blanks, bankKey]);

  // Support legacy __n__ markers by normalizing them to [[n]]
  const normalizedStem = useMemo(() => stem.replace(/__(\d+)__/g, "[[$1]]"), [stem]);
  const parts = useMemo(() => normalizedStem.split(/\[\[(\d+)\]\]/g), [normalizedStem]);

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

  const buildFilledText = () => {
    // Reconstruct stem by replacing [[n]] with value
    return stem.replace(/\[\[(\d+)\]\]/g, (_m, g1) => placements[g1] ?? "");
  };

  const checkNow = () => {
    const nextPer: Record<string | number, boolean> = {};
    for (const b of blanks) {
      const val = placements[b.id] ?? "";
      const good = b.answers.some((a) => normalize(a, b.caseSensitive, b.ignorePunct) === normalize(val, b.caseSensitive, b.ignorePunct));
      nextPer[b.id] = good;
    }
    setPerBlank(nextPer);
    setChecked(true);
    const allCorrect = Object.values(nextPer).every(Boolean);
    onAnswer({ perBlank: nextPer, allCorrect, filledText: buildFilledText(), mode: "auto" });
  };

  return (
    <div className="w-full max-w-3xl">
  <div className="prose prose-slate">
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragCancel={onDragCancel} onDragEnd={onDragEnd} collisionDetection={rectIntersection}>
          <p>
            {parts.map((p, i) => {
              if (i % 2 === 1) {
                const id = parts[i];
                const spec = blanks.find((b) => String(b.id) === String(id));
                const mode = spec?.mode ?? "either";
                const val = placements[id] ?? "";
                const droppable = mode !== "free"; // only droppable when bank/either
                const handler = mode === "bank" ? undefined : (v: string) => setPlacements((prev) => ({ ...prev, [id]: v }));
                const label = `Blank ${id}`;
                const hasError = checked ? !perBlank[id] : false;
                const showClear = Boolean(val);
                return (
                  <BlankSlot
                    key={i}
                    id={id}
                    value={val}
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
                  />
                );
              }
              return <span key={i}>{p}</span>;
            })}
          </p>
          {bank.length > 0 && (
            <div className="mt-4">
              <p className="font-valid text-sm text-slate-500 mb-2">Word bank</p>
              <div className="flex flex-wrap gap-2">{bank.map((t) => (<Token key={t} id={t} text={t} />))}</div>
            </div>
          )}
        </DndContext>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="font-valid px-3 py-2 rounded bg-blue-600 text-white" onClick={checkNow}>{submitLabel}</button>
        {selfCheck ? <span className="font-valid text-xs rounded bg-slate-100 px-2 py-1 text-slate-600">Self-check</span> : null}
        {checked && explanation ? <span className="text-sm text-slate-600">{explanation}</span> : null}
      </div>
    </div>
  );
}
