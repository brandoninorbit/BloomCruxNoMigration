"use client";

import React, { useEffect, useState } from "react";
import { playCorrectSound } from "@/lib/audio";
import { DndContext, DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import FormattedText from "@/components/ui/FormattedText";

type Item = { id: string; label: string };

type Props = {
  prompt: string;
  steps: string[];
  explanation?: string;
  formattingEnabled?: boolean;
  onAnswer: (res: { allCorrect: boolean; wrongIndexes?: number[]; order?: string[]; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean }) => void;
  onContinue?: () => void;
};

export default function SequencingStudy({ prompt, steps, explanation, formattingEnabled = true, onAnswer, onContinue }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState<{ allCorrect: boolean; wrongIndexes?: number[] } | null>(null);
  const [confidence, setConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [guessed, setGuessed] = useState(false);
  // Toggle between user's attempt and the correct sequence
  const [showCorrect, setShowCorrect] = useState(false);
  const attemptRef = React.useRef<Item[] | null>(null);
  const startRef = React.useRef<number>(Date.now());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    // initialize shuffled items when prompt/steps change
    const shuffled = [...steps].sort(() => Math.random() - 0.5).map((s, i) => ({ id: `${i}-${String(s).slice(0,20)}`, label: s }));
    setItems(shuffled);
    setChecked(false);
    setResult(null);
  setConfidence(undefined);
  setGuessed(false);
  setShowCorrect(false);
  attemptRef.current = null;
  startRef.current = Date.now();
  }, [prompt, steps]);

  const onDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;
    const oldIndex = items.findIndex((it) => it.id === activeId);
    const newIndex = items.findIndex((it) => it.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    setItems((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  const checkOrder = () => {
    const correct = steps;
    const wrongIndexes: number[] = [];
    for (let i = 0; i < correct.length; i++) {
      if (items[i]?.label !== correct[i]) wrongIndexes.push(i);
    }
    const allCorrect = wrongIndexes.length === 0;
  // Save the user's attempt so we can restore it later
  attemptRef.current = items;
  setResult({ allCorrect, wrongIndexes });
    setChecked(true);
  const responseMs = Date.now() - startRef.current;
  onAnswer({ allCorrect, wrongIndexes, order: items.map((i) => i.label), responseMs, confidence, guessed });
  if (allCorrect) playCorrectSound();
  };

  function Row({ item, index, showCorrectFlag }: { item: Item; index: number; showCorrectFlag: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, willChange: "transform, opacity" };
    // When showing the correct sequence, force green (do not keep prior red highlights)
    const wrong = checked && !showCorrectFlag && result?.wrongIndexes?.includes(index);
    const statusClass = checked
      ? (showCorrectFlag
          ? "bg-green-50 border-green-300 text-green-800"
          : (wrong ? "bg-red-50 border-red-300 text-red-800" : "bg-green-50 border-green-300 text-green-800"))
      : "bg-white";
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`flex items-center gap-3 rounded border p-3 shadow-sm transition-all duration-200 ease-out ${statusClass} ${isDragging ? "opacity-80 shadow-2xl scale-105" : "cursor-grab hover:shadow-md"}`}>
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-semibold">{index + 1}</div>
        <div className="flex-1 text-slate-800"><FormattedText text={item.label} enabled={formattingEnabled} /></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
  <h2 className="text-2xl font-semibold mb-4 text-slate-900"><FormattedText text={prompt} enabled={formattingEnabled} /></h2>
      <div className="prose prose-slate">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <Row key={it.id} item={it} index={idx} showCorrectFlag={showCorrect} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {checked ? (
        <div className="mt-3">
          {!showCorrect ? (
            <button
              type="button"
              onClick={() => {
                // Switch to the correct order
                const correctItems: Item[] = steps.map((s, i) => ({ id: `correct-${i}-${String(s).slice(0,20)}` , label: s }));
                setItems(correctItems);
                setShowCorrect(true);
              }}
              className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm"
            >
              Show correct sequence
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                // Restore the user's attempt
                if (attemptRef.current) setItems(attemptRef.current);
                setShowCorrect(false);
              }}
              className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm"
            >
              Show my attempt
            </button>
          )}
          {explanation ? (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">Explanation</div>
              <div className="text-sm leading-relaxed"><FormattedText text={explanation} enabled={formattingEnabled} /></div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!checked ? (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <label htmlFor="seq-confidence" className="text-sm text-slate-600">Confidence</label>
            <select id="seq-confidence" value={confidence ?? ""} onChange={(e) => setConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
              <option value="">-</option>
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <label className="ml-2 text-sm"><input type="checkbox" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} className="mr-1"/>Guessed</label>
          </div>
          <button type="button" onClick={checkOrder} className="px-4 py-2 rounded-lg bg-[#2481f9] text-white">Check Order</button>
        </div>
      ) : null}

      {result ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${result.allCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
          <div className="flex items-center gap-3">
            <div>
              {result.allCorrect ? (
                <svg className="h-5 w-5 text-green-600 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </div>
            <div className="font-semibold">{result.allCorrect ? "All items correctly sequenced" : "Some items are out of order"}</div>
          </div>
          <button type="button" className={`px-4 py-2 rounded-lg ${result.allCorrect ? "bg-green-600 text-white" : "bg-red-600 text-white"}`} onClick={() => { if (typeof onContinue === 'function') onContinue(); }}>
            Continue
          </button>
        </div>
      ) : null}
    </div>
  );
}
