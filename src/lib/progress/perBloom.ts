import type { DeckBloomLevel } from "@/types/deck-cards";

export type PerBloomSeenMap = Record<DeckBloomLevel, { seen: number; correctFloat: number } | undefined>;
export type Breakdown = Record<string, { scorePct: number; cardsSeen: number; cardsCorrect: number }>;

// Convert a map of per-bloom seen/correctFloat to the mission breakdown payload.
export function toBreakdown(map: PerBloomSeenMap): Breakdown {
  const res: Breakdown = {};
  const levels: DeckBloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
  for (const lvl of levels) {
    const entry = map[lvl];
    if (!entry) continue;
    const seen = Math.max(0, Number(entry.seen || 0));
    const correctFloat = Math.max(0, Number(entry.correctFloat || 0));
    if (seen <= 0) continue;
    const pct = seen > 0 ? Math.max(0, Math.min(100, (correctFloat / seen) * 100)) : 0;
    res[lvl] = { scorePct: Math.round(pct * 10) / 10, cardsSeen: seen, cardsCorrect: Math.round(correctFloat) };
  }
  return res;
}
