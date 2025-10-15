import { test, expect, describe } from "vitest";
import { computePass } from "@/lib/quest/engine";
import type { MissionState } from "@/lib/quest/types";

function makeState(total: number, correctCount: number): MissionState {
  return {
    deckId: 1,
    bloomLevel: "Understand",
    missionIndex: 0,
    sequenceSeed: "seed",
    cardOrder: Array.from({ length: total }, (_, i) => i + 1),
    answered: [],
    correctCount,
    startedAt: new Date().toISOString(),
  };
}

describe("computePass epsilon threshold behavior", () => {
  test("59.95% should not pass when threshold is 60%", () => {
    const total = 200; // use large total to represent fractional correctness precisely
    const correctCount = total * 0.5995; // 59.95%
    const res = computePass(makeState(total, correctCount), { passThreshold: 60 });
    // Display rounds to one decimal (60.0%), but pass/fail uses raw float
    expect(res.percent).toBeCloseTo(60.0, 1);
    expect(res.passed).toBe(false);
  });

  test("60.0% should pass when threshold is 60%", () => {
    const total = 200;
    const correctCount = total * 0.60; // exactly 60%
    const res = computePass(makeState(total, correctCount), { passThreshold: 60 });
    expect(res.percent).toBeCloseTo(60.0, 1);
    expect(res.passed).toBe(true);
  });

  test(
    "slightly above threshold (60.0001%) should pass due to raw float compare",
    () => {
      const total = 100000; // allow fine granularity
      const correctCount = total * 0.600001;
      const res = computePass(makeState(total, correctCount), { passThreshold: 60 });
      expect(res.passed).toBe(true);
    }
  );
});
