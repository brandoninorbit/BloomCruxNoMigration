"use client";
import React from "react";
import type { DeckBloomLevel, DeckStandardMCQ } from "@/types/deck-cards";
import { BLOOM_COLOR_HEX } from "@/types/card-catalog";

type Props = {
  card: DeckStandardMCQ;
  level: DeckBloomLevel;
  disabled?: boolean;
  onAnswer?: (choice: "A" | "B" | "C" | "D") => void;
};

export function MCQCard({ card, level, disabled, onAnswer }: Props) {
  const base = BLOOM_COLOR_HEX[level];
  const hoverBg = `${base}22`; // subtle stained-glass tint
  const options: Array<["A"|"B"|"C"|"D", string]> = [
    ["A", card.meta.options.A],
    ["B", card.meta.options.B],
    ["C", card.meta.options.C],
    ["D", card.meta.options.D],
  ];

  return (
    <div className="w-full max-w-3xl">
      <h2 className="text-xl font-semibold mb-4 text-slate-900">{card.question}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map(([k, text]) => (
          <button
            key={k}
            disabled={disabled}
            onClick={() => onAnswer?.(k)}
            className="text-left rounded-lg border border-slate-200 px-4 py-3 shadow-sm transition-colors"
            style={{ backgroundColor: "transparent" }}
            onMouseEnter={(e) => { (e.currentTarget.style.backgroundColor = hoverBg); }}
            onMouseLeave={(e) => { (e.currentTarget.style.backgroundColor = "transparent"); }}
          >
            <div className="flex items-start gap-2">
              <span className="font-bold text-slate-700">{k}.</span>
              <span className="text-slate-800">{text}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
