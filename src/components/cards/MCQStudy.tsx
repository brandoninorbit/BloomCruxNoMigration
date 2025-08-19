"use client";
import React, { useState } from "react";

export type MCQOption = { key: "A" | "B" | "C" | "D"; text: string };

type Props = {
  prompt: string;
  options: MCQOption[];
  answerKey: "A" | "B" | "C" | "D";
  explanation?: string;
  submitLabel?: string;
  onAnswer: (result: { correct: boolean; chosen: "A" | "B" | "C" | "D"; mode: "auto" }) => void;
};

export default function MCQStudy({ prompt, options, answerKey, explanation, submitLabel = "Check Answer", onAnswer }: Props) {
  const [chosen, setChosen] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [checked, setChecked] = useState(false);
  const handleCheck = () => {
    if (!chosen) return;
    const correct = chosen === answerKey;
    setChecked(true);
    onAnswer({ correct, chosen, mode: "auto" });
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
        <button disabled={!chosen} onClick={handleCheck} className="font-valid px-3 py-2 rounded bg-blue-600 disabled:opacity-50 text-white">{submitLabel}</button>
        {checked && explanation ? <p className="text-sm text-slate-600">{explanation}</p> : null}
      </div>
    </div>
  );
}
