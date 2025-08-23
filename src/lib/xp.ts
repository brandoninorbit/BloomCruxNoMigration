// src/lib/xp.ts
// Commander level progression with ~1.5x per-level XP costs.
// Examples targeted: L2=200, L3=500, L4=900, L5=1500 (cumulative thresholds)

export type LevelState = {
  level: number; // 1-based level number
  totalXp: number;
  currentThreshold: number; // cumulative XP required to reach current level
  nextThreshold: number; // cumulative XP required to reach next level
  xpIntoLevel: number; // XP into current level (totalXp - currentThreshold)
  xpForLevel: number; // XP needed to go from current level to next level
  xpToNext: number; // XP remaining to reach next level
};

// Generate cumulative thresholds where:
// - Level 1 threshold = 0
// - Cost to go from L1->L2 = 200 (base)
// - Each subsequent level cost increases by ~1.5x (rounded to nearest 50)
// Example costs: 200, 300, 450, 675, ... (rounded to 200, 300, 450, 700, ...)
// Cumulative thresholds match ~200, 500, 950, 1650, ...
function generateThresholds(maxLevel = 100, base = 200, mult = 1.5): number[] {
  const thresholds: number[] = [0]; // cumulative XP, index=level-1
  let cost = base;
  for (let lvl = 2; lvl <= maxLevel; lvl++) {
    // Round to nearest 50 for clean numbers
    const rounded = Math.round(cost / 50) * 50;
    const cum = thresholds[thresholds.length - 1] + rounded;
    thresholds.push(cum);
    cost = cost * mult;
  }
  return thresholds;
}

const DEFAULT_THRESHOLDS = generateThresholds();

export function levelFromXp(totalXp: number, thresholds: number[] = DEFAULT_THRESHOLDS): LevelState {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  // Find highest level where cumulative threshold <= xp
  let levelIdx = 0; // index in thresholds, levelIdx=0 -> level 1
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) levelIdx = i;
    else break;
  }
  const level = levelIdx + 1;
  const currentThreshold = thresholds[levelIdx] ?? 0;
  const nextThreshold = thresholds[levelIdx + 1] ?? (currentThreshold + 1000000);
  const xpIntoLevel = Math.max(0, xp - currentThreshold);
  const xpForLevel = Math.max(1, nextThreshold - currentThreshold);
  const xpToNext = Math.max(0, nextThreshold - xp);
  return { level, totalXp: xp, currentThreshold, nextThreshold, xpIntoLevel, xpForLevel, xpToNext };
}

// Convenience for commander XP
export function commanderLevel(totalCommanderXp: number): LevelState {
  return levelFromXp(totalCommanderXp);
}
