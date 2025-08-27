// src/lib/xp.ts
// Central XP model: smooth polynomial thresholds (precomputed) and award math.

export type BloomLevel = "Remember"|"Understand"|"Apply"|"Analyze"|"Evaluate"|"Create";

// Precomputed cumulative thresholds for levels 1..30 (index 1-based).
const CUM_THRESHOLDS_1_TO_30: number[] = [
  // index 0 unused for convenience
  0,      // L0 (unused)
  0,      // L1
  200,    // L2
  489,    // L3
  877,    // L4
  1374,   // L5
  1992,   // L6
  2739,   // L7
  3626,   // L8
  4663,   // L9
  5862,   // L10
  7231,   // L11
  8781,   // L12
  10523,  // L13
  12467,  // L14
  14622,  // L15
  17000,  // L16
  19610,  // L17
  22463,  // L18
  25569,  // L19
  28939,  // L20
  32581,  // L21
  36508,  // L22
  40728,  // L23
  45253,  // L24
  50092,  // L25
  55256,  // L26
  60756,  // L27
  66600,  // L28
  72800,  // L29
  79366,  // L30
];

function clampLevel(n: number): number {
  const x = Math.max(1, Math.floor(Number(n) || 1));
  return Math.min(30, x);
}

export const XP_MODEL = {
  // Base XP per correct (do not change)
  BASE_XP_PER_CORRECT: 4,

  // Bloom multipliers (unchanged)
  BLOOM_MULTIPLIER: {
    Remember: 1.0,
    Understand: 1.25,
    Apply: 1.5,
    Analyze: 2.0,
    Evaluate: 2.5,
    Create: 3.0,
  } as Record<BloomLevel, number>,

  /** Cumulative XP needed to have reached commander level N. Level 1 = 0. */
  xpThresholdForLevel(level: number): number {
    const L = clampLevel(level);
    return CUM_THRESHOLDS_1_TO_30[L] ?? 0;
  },

  /** Given a cumulative XP total, compute user’s level & progress to next. */
  progressFor(xpTotal: number): { level: number; current: number; nextLevel: number; toNext: number } {
    const xp = Math.max(0, Math.floor(Number(xpTotal) || 0));
    // Find highest level in [1..30] with threshold <= xp
    let level = 1;
    for (let L = 1; L <= 30; L++) {
      if (xp >= CUM_THRESHOLDS_1_TO_30[L]) level = L;
      else break;
    }
    const capped = level >= 30;
    const nextLevel = capped ? level : level + 1;
    const currentThreshold = CUM_THRESHOLDS_1_TO_30[level] ?? 0;
    const nextThreshold = CUM_THRESHOLDS_1_TO_30[nextLevel] ?? currentThreshold;
    const current = Math.max(0, xp - currentThreshold);
    const toNext = Math.max(0, nextThreshold - xp);
    return { level, current, nextLevel, toNext };
  },

  /** XP grant for a mission. 4 XP/correct × Bloom multiplier. */
  awardForMission(p: { correct: number; total: number; bloom: BloomLevel }): number {
    const correct = Math.max(0, Math.floor(Number(p.correct) || 0));
    const mult = (this.BLOOM_MULTIPLIER[p.bloom] ?? 1.0);
    const base = this.BASE_XP_PER_CORRECT;
    const xp = correct * base * mult;
    return Math.max(0, Math.round(xp));
  },

  /** Sum XP across a per-bloom breakdown. Accepts { [bloom]: { correct, total } }. */
  awardForBreakdown(breakdown: Partial<Record<BloomLevel, { correct: number; total: number }>>): number {
    if (!breakdown || typeof breakdown !== 'object') return 0;
    let sum = 0;
    (Object.keys(breakdown) as BloomLevel[]).forEach((b) => {
      const v = (breakdown as Record<string, { correct: number; total: number } | undefined>)[b];
      if (!v) return;
      const correct = Math.max(0, Math.floor(Number(v.correct) || 0));
      const total = Math.max(0, Math.floor(Number(v.total) || 0));
      if (total <= 0 && correct <= 0) return;
      sum += this.awardForMission({ correct, total, bloom: b });
    });
    return Math.max(0, Math.round(sum));
  },
} as const;

// Keep tokens helper exported for consistency with previous callers.
/** Tokens are 0.25 * XP, always rounded up to a whole number. */
export function tokensFromXp(xp: number): number {
  return Math.max(0, Math.ceil(Number(xp) * 0.25));
}
