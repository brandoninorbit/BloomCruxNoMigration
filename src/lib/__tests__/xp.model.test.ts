import { describe, it, expect } from "vitest";
import { XP_MODEL, type BloomLevel } from "@/lib/xp";

describe("XP_MODEL thresholds", () => {
  const table = [
    0,0,200,489,877,1374,1992,2739,3626,4663,5862,7231,8781,10523,12467,14622,17000,19610,22463,25569,28939,32581,36508,40728,45253,50092,55256,60756,66600,72800,79366
  ];
  it("xpThresholdForLevel matches table (1..30)", () => {
    for (let L=1; L<=30; L++) {
      expect(XP_MODEL.xpThresholdForLevel(L)).toBe(table[L]);
    }
  });
  it("monotone non-decreasing thresholds", () => {
    let prev = -1;
    for (let L=1; L<=30; L++) {
      const v = XP_MODEL.xpThresholdForLevel(L);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("XP_MODEL progress", () => {
  it("L1 at 0 xp", () => {
    const p = XP_MODEL.progressFor(0);
    expect(p.level).toBe(1);
    expect(p.current).toBe(0);
  });
  it("L2 boundary", () => {
    const p = XP_MODEL.progressFor(200);
    expect(p.level).toBe(2);
    expect(p.toNext).toBeGreaterThanOrEqual(0);
  });
});

describe("XP_MODEL award", () => {
  it("4 xp per correct times bloom multiplier", () => {
    const x = XP_MODEL.awardForMission({ correct: 5, total: 10, bloom: "Apply" });
    // 5 * 4 * 1.5 = 30
    expect(x).toBe(30);
  });
  it("awardForBreakdown sums per-bloom correctly", () => {
    const input: Partial<Record<BloomLevel, { correct: number; total: number }>> = {
      Remember: { correct: 2, total: 5 }, // 2 * 4 * 1 = 8
      Apply: { correct: 1, total: 3 }, // 1 * 4 * 1.5 = 6
    };
    const xp = XP_MODEL.awardForBreakdown(input);
    expect(xp).toBe(14);
  });
});
