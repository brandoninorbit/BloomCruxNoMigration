import React from "react";

type Props = {
  current: number;
  total: number;
  color: string; // hex or css color
  label?: string;
};

export function QuestProgress({ current, total, color, label }: Props) {
  const pct = Math.max(0, Math.min(100, total > 0 ? (current / total) * 100 : 0));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-800">{label ?? "Progress"}</span>
        <span className="text-xs text-slate-500">{current}/{total}</span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
