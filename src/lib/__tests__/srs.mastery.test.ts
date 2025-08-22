import { test, expect } from "vitest";
import { normalizeCorrectness } from "@/types/mastery";
import { gradeFromOutcome } from "@/lib/srs";
import { updateCardMastery } from "@/lib/mastery";
import { Bloom } from "@/lib/bloom";
import type { CardMastery, ReviewOutcome } from "@/types/mastery";

// Minimal mocks
const freshCard = (cardId = "1"): CardMastery => ({
  cardId,
  bloom: Bloom.Remember,
  srs: { ef: 2.5, reps: 0, intervalDays: 0, nextDueIso: new Date().toISOString(), history: [] },
  spacing: { spacedShortOk: false, spacedLongOk: false, consecutiveSpacedSuccesses: 0 },
  accuracy: { k: 5, ptr: -1, outcomes: [] as (0|1)[] },
  confidence: { ewma: 0, lambda: 0.6 },
  Ri: 0, Ai: 0, Ci: 0, Mi: 0, updatedIso: new Date().toISOString(),
});

test('normalize correctness handles mixed inputs', () => {
  expect(normalizeCorrectness(true)).toBe(1);
  expect(normalizeCorrectness(false)).toBe(0);
  expect(normalizeCorrectness(undefined)).toBe(0);
  expect(normalizeCorrectness(0.5)).toBeCloseTo(0.5);
  expect(normalizeCorrectness(2)).toBe(1);
  expect(normalizeCorrectness(-1)).toBe(0);
});

test('gradeFromOutcome maps fractional correctness linearly', () => {
  const g0 = gradeFromOutcome({ correctness: 0 });
  const g1 = gradeFromOutcome({ correctness: 1 });
  const g05 = gradeFromOutcome({ correctness: 0.5 });
  expect(g0).toBeGreaterThanOrEqual(0);
  expect(g1).toBeGreaterThanOrEqual(g05);
  expect(g05).toBeGreaterThanOrEqual(g0);
});

test('updateCardMastery accepts fractional correctness and updates Mi', () => {
  const prev = freshCard();
  const out: ReviewOutcome = { correctness: 0.5, confidence: 2 };
  const next = updateCardMastery(prev, out);
  expect(next.Mi).toBeGreaterThanOrEqual(0);
  expect(next.Mi).toBeLessThanOrEqual(1);
});
