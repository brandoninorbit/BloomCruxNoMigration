// Minimal utils used by shadcn-style components. No external deps.
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// Clamp to [0,100], round to one decimal, and append % for display only.
export function formatPercent1(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, Math.min(100, n));
  return `${clamped.toFixed(1)}%`;
}
