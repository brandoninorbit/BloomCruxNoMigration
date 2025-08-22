import type { DeckBloomLevel, DeckCard } from "@/types/deck-cards";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { DEFAULT_QUEST_SETTINGS, MissionComputeInput, MissionSet, MissionState, QuestSettings, SRSPerformance, UserBloomProgress, MissionComposition, XpLedger } from "./types";

function hashStringToInt(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleDeterministic<T>(arr: T[], seed: string): T[] {
  const rng = mulberry32(hashStringToInt(seed));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function computeMissionSet(input: MissionComputeInput): MissionSet {
  const { allCards, level, settings: s } = input;
  const settings: QuestSettings = { ...DEFAULT_QUEST_SETTINGS, ...(s ?? {}) };

  const levelIdx = BLOOM_LEVELS.indexOf(level);
  const lowerLevels = BLOOM_LEVELS.slice(0, Math.max(0, levelIdx));

  const isActive = input.isActive
    ? input.isActive
    : input.activeCardIds
    ? (c: DeckCard) => input.activeCardIds!.includes(c.id)
    : () => true;

  const primary = allCards.filter((c) => isActive(c) && (c.bloomLevel ?? "Remember") === level);
  // Blasts: draw from lower levels only; for "Evaluate" specifically, include up to Analyze only
  const effectiveLowerLevels: DeckBloomLevel[] = (level === "Evaluate")
    ? BLOOM_LEVELS.slice(0, BLOOM_LEVELS.indexOf("Evaluate")) // Remember..Analyze
    : lowerLevels;
  const lowerPool = allCards.filter((c) => isActive(c) && effectiveLowerLevels.includes((c.bloomLevel ?? "Remember") as DeckBloomLevel));

  // blasts from the pasts: percentage of total cards up to current level
  const totalUpTo = primary.length + lowerPool.length;
  const blastsCount = Math.floor((settings.blastsPercent / 100) * totalUpTo);
  // bias blasts to least-recently-reviewed (oldest lastSeenAt first)
  const blastsSorted = [...lowerPool].sort((a, b) => {
    const aPerf = input.srs?.[a.id];
    const bPerf = input.srs?.[b.id];
    const aTime = aPerf?.lastSeenAt ? Date.parse(aPerf.lastSeenAt) : 0;
    const bTime = bPerf?.lastSeenAt ? Date.parse(bPerf.lastSeenAt) : 0;
    if (aTime !== bTime) return aTime - bTime; // older first
    // tiebreaker deterministic by id
    return a.id - b.id;
  });
  // Include missionIndex/seed so blasts vary across missions at the same level
  const blastsSeed = `${input.deckId}:${level}:blasts:${input.missionIndex ?? 0}:${input.seed ?? ""}`;
  const blasts = shuffleDeterministic(blastsSorted, blastsSeed).slice(0, blastsCount);

  // review: use provided low-accuracy candidates if available; otherwise fallback to SRS-derived ranking
  let review: DeckCard[] = [];
  const byId = new Map(allCards.map((c) => [c.id, c] as const));
  if (input.reviewCandidateIds && input.reviewCandidateIds.length) {
    // Restrict to lower levels (Remember..Analyze) when level is Evaluate; otherwise to lowerLevels
    const allowed = new Set(
      allCards
        .filter((c) => effectiveLowerLevels.includes((c.bloomLevel ?? "Remember") as DeckBloomLevel))
        .map((c) => c.id)
    );
    review = input.reviewCandidateIds
      .filter((id) => allowed.has(id))
      .map((id) => byId.get(id))
      .filter((v): v is DeckCard => Boolean(v))
      .filter((c) => isActive(c));
  } else if (input.srs) {
    // Fallback: SRS performance heuristic, restricted to allowed lower levels
    const allowed = new Set(
      allCards
        .filter((c) => effectiveLowerLevels.includes((c.bloomLevel ?? "Remember") as DeckBloomLevel))
        .map((c) => c.id)
    );
    const entries = Object.entries(input.srs)
      .map(([cardId, perf]) => ({ cardId: Number(cardId), perf }))
      .filter((e) => allowed.has(e.cardId))
      .sort((a, b) => {
        const aWrong = a.perf.attempts - a.perf.correct;
        const bWrong = b.perf.attempts - b.perf.correct;
        if (aWrong !== bWrong) return bWrong - aWrong; // most wrong first
        // tie-breaker: fewer attempts indicates less practice
        return a.perf.attempts - b.perf.attempts;
      });
    const windowSize = Math.max(0, Math.ceil(primary.length * 0.2));
    const allIdsSorted = entries.map((e) => e.cardId);
    if (windowSize > 0 && allIdsSorted.length > 0) {
      const rotSeed = `${input.deckId}:${level}:review:${input.missionIndex ?? 0}:${input.seed ?? ""}`;
      const rot = hashStringToInt(rotSeed) % allIdsSorted.length;
      const rotated = [...allIdsSorted.slice(rot), ...allIdsSorted.slice(0, rot)];
      const chosen = rotated.slice(0, Math.min(windowSize, rotated.length));
      const reviewIds = new Set(chosen);
      review = [...reviewIds]
        .map((id) => byId.get(id))
        .filter((v): v is DeckCard => Boolean(v))
        .filter((c) => isActive(c));
    }
  }
  // Do not include review for Remember (initial tier)
  if (level === "Remember") review = [];

  return { cards: primary, blasts, review };
}

export function composeMission(input: MissionComputeInput): MissionComposition {
  const { deckId, level, missionIndex = 0, seed } = input;
  const sets = computeMissionSet(input);

  // split primaries into fixed membership chunks
  const primaryChunks = splitIntoMissions(sets.cards, (input.settings?.missionCap ?? DEFAULT_QUEST_SETTINGS.missionCap));
  const chosenPrimary = primaryChunks[missionIndex] ?? [];

  // no duplicates; build ordered selection pools
  const uniq = (arr: number[]) => Array.from(new Set(arr));
  const primaryIds = uniq(chosenPrimary);
  const blastsIds = uniq(sets.blasts.map((c) => c.id).filter((id) => !primaryIds.includes(id)));
  const reviewIds = uniq(sets.review.map((c) => c.id).filter((id) => !primaryIds.includes(id) && !blastsIds.includes(id)));

  const cap = input.settings?.missionCap ?? DEFAULT_QUEST_SETTINGS.missionCap;
  let missionIds: number[] = [...primaryIds, ...blastsIds, ...reviewIds];
  let trimmedFromBlasts = 0;
  let trimmedFromReview = 0;
  if (missionIds.length > cap) {
    const overflow = missionIds.length - cap;
    // trim blasts first
    if (blastsIds.length >= overflow) {
      const keepBlasts = blastsIds.slice(0, blastsIds.length - overflow);
      trimmedFromBlasts = blastsIds.length - keepBlasts.length;
      missionIds = [...primaryIds, ...keepBlasts, ...reviewIds];
    } else {
      // remove all blasts and then trim review remainder
      trimmedFromBlasts = blastsIds.length;
      const remainingOverflow = overflow - blastsIds.length;
      const keepReview = reviewIds.slice(0, Math.max(0, reviewIds.length - remainingOverflow));
      trimmedFromReview = reviewIds.length - keepReview.length;
      missionIds = [...primaryIds, ...keepReview];
    }
  }

  const seedUsed = seed ?? `${deckId}:${level}:${missionIndex}`;
  const shuffled = shuffleDeterministic(missionIds, seedUsed);

  return {
    primaryIds,
    blastsIds,
    reviewIds,
    missionIds: shuffled,
    seedUsed,
    debug: {
      primaryCount: primaryIds.length,
      blastsRequested: sets.blasts.length,
      blastsChosen: blastsIds.length,
      reviewRequested: sets.review.length,
      reviewChosen: reviewIds.length,
      trimmedFromBlasts,
      trimmedFromReview,
      total: shuffled.length,
    },
  };
}

export function splitIntoMissions(pool: DeckCard[], cap: number): number[][] {
  const ids = pool.map((c) => c.id);
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += cap) chunks.push(ids.slice(i, i + cap));
  return chunks;
}

export function startMission(options: {
  deckId: number;
  level: DeckBloomLevel;
  missionIndex: number;
  poolIds: number[]; // the mission's card ids
  seed?: string;
}): MissionState {
  const sequenceSeed = options.seed ?? `${options.deckId}:${options.level}:${Date.now()}:${Math.random()}`;
  const shuffled = shuffleDeterministic(options.poolIds, sequenceSeed);
  return {
    deckId: options.deckId,
    bloomLevel: options.level,
    missionIndex: options.missionIndex,
    sequenceSeed,
    cardOrder: shuffled,
    answered: [],
    correctCount: 0,
    startedAt: new Date().toISOString(),
  };
}

export function resumeMission(state: MissionState): MissionState {
  // Preserve current sequence; only mark resume time
  return { ...state, resumedAt: new Date().toISOString() };
}

export function toNumericCorrect(v: boolean | number): number {
  if (typeof v === "number") return Math.max(0, Math.min(1, v));
  return v ? 1 : 0;
}

export function recordAnswer(state: MissionState, cardId: number, correct: boolean | number): MissionState {
  if (!state.cardOrder.includes(cardId)) return state;
  const exists = state.answered.find((a) => a.cardId === cardId);
  if (exists) {
    // update existing
    const updated = state.answered.map((a) => (a.cardId === cardId ? { cardId, correct } : a));
    const correctCount = updated.reduce((s, a) => s + toNumericCorrect(a.correct), 0);
    return { ...state, answered: updated, correctCount };
  }
  const answered = [...state.answered, { cardId, correct }];
  const correctCount = answered.reduce((s, a) => s + toNumericCorrect(a.correct), 0);
  return { ...state, answered, correctCount };
}

export function restartMission(state: MissionState): MissionState {
  const seed = `${state.deckId}:${state.bloomLevel}:${Date.now()}:${Math.random()}`;
  const resequenced = shuffleDeterministic(state.cardOrder, seed);
  return {
    ...state,
    sequenceSeed: seed,
    cardOrder: resequenced,
    answered: [],
    correctCount: 0,
    startedAt: new Date().toISOString(),
    resumedAt: undefined,
  };
}

export function computePass(state: MissionState, settings?: Partial<QuestSettings>): { total: number; correct: number; percent: number; passed: boolean } {
  const s = { ...DEFAULT_QUEST_SETTINGS, ...(settings ?? {}) };
  const total = state.cardOrder.length;
  const correct = state.correctCount;
  const pctFloat = total > 0 ? (correct / total) * 100 : 0;
  const percent = Math.round(pctFloat * 10) / 10;
  // Pass/fail must use raw float vs threshold with a small epsilon (no integer rounding)
  const EPS = 1e-6;
  const passed = (pctFloat + EPS) >= s.passThreshold;
  return { total, correct, percent, passed };
}

// Utilities for consistency-based progression
export function computeWeightedAvg(attempts: Array<{ percent: number }>): number {
  if (!attempts || attempts.length === 0) return 0;
  const n = attempts.length;
  const weights = attempts.map((_, i) => i + 1);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const vals = attempts.map((a) => a.percent);
  return Math.round(vals.reduce((acc, v, i) => acc + v * weights[i]!, 0) / Math.max(1, sumW));
}

export function hasCollapse(attempts: Array<{ percent: number }>): boolean {
  const last3 = attempts.slice(-3);
  for (let i = 1; i < last3.length; i++) {
    if (last3[i - 1]!.percent < 50 && last3[i]!.percent < 50) return true;
  }
  return false;
}

export function completionCopy(level: DeckBloomLevel, state: MissionState): string {
  const total = state.cardOrder.length;
  const correct = state.correctCount;
  const pct = total > 0 ? Math.round(((correct / total) * 100) * 10) / 10 : 0;
  return `Mission complete: ${level} progress ${pct}% (${correct}/${total} cards).`;
}

// simple user progress tracker (per deck) in localStorage for now
const STORAGE_KEY = (deckId: number) => `quest:${deckId}`;
const SRS_KEY = (deckId: number) => `quest:srs:${deckId}`;

type Stored = {
  progress: UserBloomProgress;
  mission?: MissionState;
  xp?: XpLedger;
};

export function loadProgress(deckId: number): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY(deckId));
    if (!raw) return null;
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

export function saveProgress(deckId: number, stored: Stored): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY(deckId), JSON.stringify(stored));
}

export function initUserBloomProgress(allCards: DeckCard[]): UserBloomProgress {
  const byLevel: Record<DeckBloomLevel, number> = { Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0 };
  for (const c of allCards) byLevel[(c.bloomLevel ?? "Remember") as DeckBloomLevel]++;
  const res = {} as UserBloomProgress;
  (Object.keys(byLevel) as DeckBloomLevel[]).forEach((lvl) => {
    res[lvl] = {
      totalCards: byLevel[lvl],
      completedCards: 0,
      missionsCompleted: 0,
      masteryPercent: 0,
      mastered: false,
  commanderGranted: false,
  accuracySum: 0,
  accuracyCount: 0,
  totalMissions: Math.ceil(byLevel[lvl] / DEFAULT_QUEST_SETTINGS.missionCap) || 0,
  recentAttempts: [],
  weightedAvg: 0,
  cleared: false,
    };
  });
  return res;
}

export function markMissionComplete(deckId: number, level: DeckBloomLevel, state: MissionState): void {
  const stored = loadProgress(deckId) ?? { progress: {} as UserBloomProgress } as Stored;
  if (!stored.progress[level]) return; // must be initialized elsewhere
  stored.progress[level].completedCards = Math.min(
    stored.progress[level].totalCards,
    state.cardOrder.length + stored.progress[level].completedCards
  );
  stored.progress[level].missionsCompleted += 1;
  stored.mission = undefined;
  saveProgress(deckId, stored);
}

/* ---------------- XP / Unlocks ---------------- */
const BASE_XP: Record<DeckBloomLevel, number> = {
  Remember: 10,
  Understand: 12,
  Apply: 14,
  Analyze: 16,
  Evaluate: 18,
  Create: 20,
};

const MULTIPLIER: Record<DeckBloomLevel, number> = {
  Remember: 1.0,
  Understand: 1.25,
  Apply: 1.5,
  Analyze: 2.0,
  Evaluate: 2.5,
  Create: 3.0,
};

export function initXpLedger(): XpLedger {
  const zero: Record<DeckBloomLevel, number> = { Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0 };
  const flags: Record<DeckBloomLevel, boolean> = { Remember: false, Understand: false, Apply: false, Analyze: false, Evaluate: false, Create: false };
  return { bloomXp: { ...zero }, commanderXp: { ...zero }, commanderXpTotal: 0, commanderGranted: { ...flags } };
}

export function applyMissionXp(deckId: number, level: DeckBloomLevel, accuracy: number, beforeCompleted: number, afterCompleted: number): { bloomAdded: number; commanderAdded: number; masteredNow: boolean; unlockedNext?: DeckBloomLevel } {
  const stored = loadProgress(deckId) ?? { progress: {} as UserBloomProgress, xp: initXpLedger() } as Stored;
  if (!stored.xp) stored.xp = initXpLedger();
  const prog = stored.progress[level];
  if (!prog || prog.totalCards === 0) return { bloomAdded: 0, commanderAdded: 0, masteredNow: false };

  const deltaLevelCompletion = Math.max(0, Math.min(1, (afterCompleted - beforeCompleted) / Math.max(1, prog.totalCards)));
  const base = BASE_XP[level];
  const bloomInc = base * Math.max(0, Math.min(1, accuracy)) * deltaLevelCompletion;
  stored.xp.bloomXp[level] = (stored.xp.bloomXp[level] ?? 0) + bloomInc;

  // Update accuracy roll-up
  prog.accuracySum = (prog.accuracySum ?? 0) + accuracy;
  prog.accuracyCount = (prog.accuracyCount ?? 0) + 1;

  // Unlock check by missionsCompleted reaching totalMissions
  let unlockedNext: DeckBloomLevel | undefined;
  if ((prog.missionsCompleted) >= (prog.totalMissions ?? 0)) {
    const idx = BLOOM_LEVELS.indexOf(level);
    if (idx >= 0 && idx + 1 < BLOOM_LEVELS.length) unlockedNext = BLOOM_LEVELS[idx + 1];
  }

  // Mastery gating: only after mastered true do we mirror into commander XP
  let commanderAdded = 0;
  if (prog.mastered) {
    // Mirror current increment
    const m = MULTIPLIER[level];
    commanderAdded = bloomInc * m;
    stored.xp.commanderXp[level] = (stored.xp.commanderXp[level] ?? 0) + commanderAdded;
    stored.xp.commanderXpTotal += commanderAdded;
  } else {
    // If just transitioned to mastered (criterion defined elsewhere), grant retroactive
    const masteredNow = (prog.masteryPercent ?? 0) >= 100 && !stored.xp.commanderGranted[level];
    if (masteredNow) {
      const grant = (stored.xp.bloomXp[level] ?? 0) * MULTIPLIER[level];
      stored.xp.commanderXp[level] = (stored.xp.commanderXp[level] ?? 0) + grant;
      stored.xp.commanderXpTotal += grant;
      stored.xp.commanderGranted[level] = true;
      saveProgress(deckId, stored);
      return { bloomAdded: bloomInc, commanderAdded: grant, masteredNow: true, unlockedNext };
    }
  }

  saveProgress(deckId, stored);
  return { bloomAdded: bloomInc, commanderAdded, masteredNow: false, unlockedNext };
}

export function loadSrs(deckId: number): SRSPerformance {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SRS_KEY(deckId));
    if (!raw) return {};
    return JSON.parse(raw) as SRSPerformance;
  } catch {
    return {};
  }
}

export function saveSrs(deckId: number, srs: SRSPerformance): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SRS_KEY(deckId), JSON.stringify(srs));
}
