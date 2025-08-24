import { describe, it, expect } from "vitest";
import { toBreakdown, type PerBloomSeenMap } from "@/lib/progress/perBloom";

describe("toBreakdown", () => {
  it("builds breakdown with rounding and skips empty", () => {
    const map: PerBloomSeenMap = {
      Remember: { seen: 3, correctFloat: 2.4 }, // 80.0%, 2 correct
      Understand: { seen: 0, correctFloat: 0 },
      Apply: { seen: 5, correctFloat: 2.6 }, // 52.0%, 3 correct
      Analyze: undefined,
      Evaluate: { seen: 1, correctFloat: 1 }, // 100%, 1
      Create: { seen: 2, correctFloat: 0.49 }, // 24.5%, 0
    };
    const b = toBreakdown(map);
    expect(b).toHaveProperty("Remember");
    expect(b.Remember).toEqual({ scorePct: 80, cardsSeen: 3, cardsCorrect: 2 });
    expect(b).not.toHaveProperty("Understand");
    expect(b).toHaveProperty("Apply");
    expect(b.Apply).toEqual({ scorePct: 52, cardsSeen: 5, cardsCorrect: 3 });
    expect(b).not.toHaveProperty("Analyze");
    expect(b).toHaveProperty("Evaluate");
    expect(b.Evaluate).toEqual({ scorePct: 100, cardsSeen: 1, cardsCorrect: 1 });
    expect(b).toHaveProperty("Create");
    expect(b.Create).toEqual({ scorePct: 24.5, cardsSeen: 2, cardsCorrect: 0 });
  });

  it("handles no levels gracefully", () => {
    const empty: PerBloomSeenMap = {
      Remember: undefined,
      Understand: undefined,
      Apply: undefined,
      Analyze: undefined,
      Evaluate: undefined,
      Create: undefined,
    };
    const b = toBreakdown(empty);
    expect(Object.keys(b).length).toBe(0);
  });
});
