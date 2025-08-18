import type { DeckBloomLevel } from "@/types/deck-cards";

export type CardType =
  | "Standard MCQ"
  | "Fill in the Blank"
  | "Short Answer"
  | "Sorting"
  | "Sequencing"
  | "Worked Example"
  | "Compare/Contrast"
  | "Categorization"
  | "Two-Tier MCQ"
  | "CER";

export const DEFAULT_BLOOM_BY_TYPE: Record<CardType, DeckBloomLevel> = {
  "Standard MCQ": "Remember",
  "Fill in the Blank": "Remember",
  "Short Answer": "Understand",
  "Sorting": "Understand",
  "Sequencing": "Apply",
  "Worked Example": "Apply",
  "Compare/Contrast": "Analyze",
  "Categorization": "Analyze",
  "Two-Tier MCQ": "Evaluate",
  "CER": "Evaluate",
} as const;

export function defaultBloomFor(type: CardType): DeckBloomLevel {
  return DEFAULT_BLOOM_BY_TYPE[type];
}

export const CARD_TYPES_BY_BLOOM: Record<DeckBloomLevel, CardType[]> = {
  Remember: ["Standard MCQ", "Fill in the Blank"],
  Understand: ["Short Answer", "Sorting"],
  Apply: ["Sequencing", "Worked Example"],
  Analyze: ["Compare/Contrast", "Categorization"],
  Evaluate: ["Two-Tier MCQ", "CER"],
  Create: [],
} as const;

export const BLOOM_LEVELS: readonly DeckBloomLevel[] = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
] as const;

// UI colors for each Bloom level (hex provided by design brief)
export const BLOOM_COLOR_HEX: Record<DeckBloomLevel, `#${string}`> = {
  Remember: "#4DA6FF", // Soft Blue — calm foundation
  Understand: "#34C759", // Green — growth
  Apply: "#FFD60A", // Yellow/Gold — action
  Analyze: "#FF9F0A", // Orange — deeper challenge
  Evaluate: "#FF375F", // Red/Pink — bold judgment
  Create: "#9D4EDD", // Purple/Violet — prestige
};

// Lighten a hex color by a percentage (0-100). Simple, good-enough utility for gradients.
function lighten(hex: string, percent: number): string {
  const p = Math.max(0, Math.min(100, percent)) / 100;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const lr = Math.round(r + (255 - r) * p);
  const lg = Math.round(g + (255 - g) * p);
  const lb = Math.round(b + (255 - b) * p);
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
}

// Create a pleasing left-to-right gradient for the fill of progress bars for a Bloom level.
// Start slightly lighter, end at the base color to give dimension.
export function gradientForBloom(level: DeckBloomLevel): string {
  const base = BLOOM_COLOR_HEX[level];
  const start = lighten(base, 18);
  return `linear-gradient(90deg, ${start} 0%, ${base} 100%)`;
}

// Parse a leading bloom override like "[Remember] Question text".
// Returns normalized Bloom (capitalized) and the cleaned text without the tag.
export function parseBloomOverride(input: string): { bloom?: DeckBloomLevel; text: string } {
  const match = input.match(/^\s*\[(remember|understand|apply|analyze|evaluate|create)\]\s*(.*)$/i);
  if (!match) return { text: input };
  const raw = match[1].toLowerCase();
  const normalized =
    raw === "remember"
      ? "Remember"
      : raw === "understand"
      ? "Understand"
      : raw === "apply"
      ? "Apply"
      : raw === "analyze"
      ? "Analyze"
      : raw === "evaluate"
      ? "Evaluate"
      : "Create";
  return { bloom: normalized, text: match[2] };
}
