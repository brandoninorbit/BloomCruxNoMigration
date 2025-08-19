"use client";
import React from "react";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { gradientForBloom } from "@/types/card-catalog";

export function LevelProgressBar({
  level,
  current,
  total,
}: {
  level: DeckBloomLevel;
  current: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{level} Mission Progress</span>
        <span className="text-sm text-slate-600">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-md overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: gradientForBloom(level) }}
        />
      </div>
    </div>
  );
}
