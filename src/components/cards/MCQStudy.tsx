"use client";
import React, { useEffect, useState } from "react";

export type MCQOption = { key: "A" | "B" | "C" | "D"; text: string };

type Props = {
  prompt: string;
  options: MCQOption[];
  answerKey: "A" | "B" | "C" | "D";
  explanation?: string;
  submitLabel?: string;
  onAnswer: (result: { correct: boolean; chosen: "A" | "B" | "C" | "D"; mode: "auto"; responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean }) => void;
  onContinue?: () => void;
};

export default function MCQStudy({ prompt, options, answerKey, explanation, submitLabel = "Check Answer", onAnswer, onContinue }: Props) {
  const [chosen, setChosen] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [guessed, setGuessed] = useState(false);
  const startRef = React.useRef<number>(Date.now());
  // Reset state when the question changes (new card)
  useEffect(() => {
    setChosen(null);
    setChecked(false);
    setConfidence(undefined);
    setGuessed(false);
    startRef.current = Date.now();
  }, [prompt, answerKey]);
  const handleCheck = () => {
    if (!chosen) return;
    const correct = chosen === answerKey;
    setChecked(true);
    const responseMs = Date.now() - startRef.current;
    onAnswer({ correct, chosen, mode: "auto", responseMs, confidence, guessed });
  };
  return (
    <div className="w-full max-w-3xl">
      <h2 className="font-valid text-2xl font-semibold mb-4 text-slate-900">{prompt}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((o) => {
          const isSelected = chosen === o.key;
          const isCorrect = checked && o.key === answerKey;
          const isWrong = checked && isSelected && !isCorrect;
          return (
            <button
              key={o.key}
              onClick={() => setChosen(o.key)}
              className={`font-valid text-left rounded-lg border px-4 py-3 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                isCorrect ? "border-green-500 bg-green-50" : isWrong ? "border-red-500 bg-red-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-700">{o.key}.</span>
                <span className="text-slate-800">{o.text}</span>
              </div>
            </button>
          );
        })}
      </div>
    <div className="mt-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
      <label htmlFor="mcq-confidence" className="text-sm text-slate-600">Confidence</label>
      <select id="mcq-confidence" value={confidence ?? ""} onChange={(e) => setConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
            <option value="">-</option>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
          <label className="ml-2 text-sm"><input type="checkbox" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} className="mr-1"/>Guessed</label>
        </div>
        <button disabled={!chosen} onClick={handleCheck} className="font-valid px-3 py-2 rounded bg-blue-600 disabled:opacity-50 text-white">{submitLabel}</button>
        {checked && explanation ? <p className="text-sm text-slate-600">{explanation}</p> : null}
      </div>
      {/* Bottom status banner (reveal answer) */}
      {checked ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${chosen === answerKey ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
          <div className="font-semibold">{chosen === answerKey ? "Correct!" : "Not quite"}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg font-medium shadow-sm ${chosen === answerKey ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}
              onClick={() => { if (typeof onContinue === 'function') onContinue(); }}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
