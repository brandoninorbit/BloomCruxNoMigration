import * as React from "react";

export type BloomLevel =
  | "Remember" | "Understand" | "Apply"
  | "Analyze"  | "Evaluate"   | "Create";

const levelColor = (lvl: BloomLevel) => ({
  Remember:"var(--bloom-remember)",
  Understand:"var(--bloom-understand)",
  Apply:"var(--bloom-apply)",
  Analyze:"var(--bloom-analyze)",
  Evaluate:"var(--bloom-evaluate)",
  Create:"var(--bloom-create)",
}[lvl]);

export function MasteryPill({
  level, percent = 0, className = "",
}: {
  level: BloomLevel;
  percent?: number;           // 0..100
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const c = levelColor(level);
  return (
    <span
      role="status"
      aria-label={`Mastery ${pct}% at ${level}`}
      className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-medium ${className}`}
      style={{ background:`${c}20`, color:c as string, border:`1px solid ${c}` }}
    >
      {pct}% · {level}
    </span>
  );
}
