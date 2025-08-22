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

// Canonical Bloom levels enum for cross-module usage
export enum Bloom {
  Remember = "Remember",
  Understand = "Understand",
  Apply = "Apply",
  Analyze = "Analyze",
  Evaluate = "Evaluate",
  Create = "Create",
}

// Normalize spacing targets used by mastery
// Note: Keep these in sync with any scheduling/SRS logic.
export const TARGET_INTERVAL_DAYS: Record<Bloom, number> = {
  [Bloom.Remember]: 7,
  [Bloom.Understand]: 10,
  [Bloom.Apply]: 14,
  [Bloom.Analyze]: 20,
  [Bloom.Evaluate]: 25,
  [Bloom.Create]: 30,
};

// Commander XP multipliers (keep in sync with your XP model)
// These align with multipliers used in quest/XP logic.
export const BLOOM_MULTIPLIER: Record<Bloom, number> = {
  [Bloom.Remember]: 1.0,
  [Bloom.Understand]: 1.25,
  [Bloom.Apply]: 1.5,
  [Bloom.Analyze]: 2.0,
  [Bloom.Evaluate]: 2.5,
  [Bloom.Create]: 3.0,
};

// Deprecated aliases (do not use):
// If older constants/enums existed with different values, prefer the above exports.
