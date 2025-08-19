import type { DeckBloomLevel, DeckCardType } from "@/types/deck-cards";

const DEFAULT_BY_TYPE: Record<DeckCardType, DeckBloomLevel> = {
  "Standard MCQ": "Remember",
  "Fill in the Blank": "Remember",
  "Short Answer": "Understand",
  "Sorting": "Understand",
  "Sequencing": "Understand",
  "Compare/Contrast": "Analyze",
  "Two-Tier MCQ": "Apply",
  "CER": "Evaluate",
};

export function defaultBloomForType(type: DeckCardType): DeckBloomLevel {
  return DEFAULT_BY_TYPE[type] ?? "Remember";
}
