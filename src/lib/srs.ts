// srs.ts
// BloomCrux SRS — SM‑2 core with psychology-informed upgrades
// - Personalized latency bonuses via per-deck quantiles
// - Relearn ladder with sub-day steps (desirable difficulty over whack-a-mole)
// - Light stochasticity (interval fuzz) to reduce clumping and promote interleaving
// - Retention target scaling (gentle) for workload↔retention control
// - Confidence has a small effect; "guessed" caps grade
// - FSRS-lite hooks: difficulty & stability fields (forward compatible)

////////////////////
// Types & helpers
////////////////////

export type ISODateString = string;

export interface ReviewOutcome {
  correctness?: number;
  // accept legacy boolean from types/mastery
  correct?: number | boolean;
  timeMs?: number;
  responseMs?: number;  // alias for timeMs for backward compatibility
  confidence?: 0 | 1 | 2 | 3;
  guessed?: boolean;
  cardType?: string;    // for Apply+ diversity checks
  nowIso?: ISODateString;
}

export interface LatencyQuantiles {
  // Quantiles for recent correct recalls in this deck/user
  p25: number; // ms
  p50: number; // ms
  p75: number; // ms
  n: number;   // sample size for sanity checks
  updatedAtIso: ISODateString;
}

export interface ReviewHistoryEntry {
  ts: ISODateString;
  grade: number; // continuous [0..5]
}

export interface SRSState {
  ef: number;             // SM-2 easiness factor (clamped)
  reps: number;           // successful repetitions in a row
  intervalDays: number;   // last planned interval (days; fractional allowed)
  nextDueIso: ISODateString;
  history: ReviewHistoryEntry[];

  // Psychology upgrades
  lapses: number;         // count of lapses (grade < 3 after non-trivial interval)
  stability: number;      // FSRS-lite: crude memory longevity proxy (↑ on success, ↓ on lapse)
  difficulty?: number;    // FSRS-lite: normalized difficulty (0 easy .. 1 hard)

  // Relearn ladder state (null/undefined if not in relearn)
  // Stages: 0 -> +20 min, 1 -> +1 d, 2 -> +3 d, 3 -> +7 d (then exit ladder)
  relearnStage?: number | null;

  // Gentle retention target for interval scaling (default ~0.90)
  retentionTarget?: number; // e.g., 0.85..0.95
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function nowIso(): ISODateString {
  return new Date().toISOString();
}

function addMinutes(iso: ISODateString, minutes: number): ISODateString {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function addDays(iso: ISODateString, days: number): ISODateString {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysBetween(aIso: ISODateString, bIso: ISODateString): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return (b - a) / (1000 * 60 * 60 * 24);
}

// random in [lo, hi]
function randRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

/////////////////////////////
// Grade computation (SM‑2)
/////////////////////////////

/**
 * gradeFromOutcome
 * Continuous grade in [0..5], SM‑2 compatible.
 * Signals:
 *  - correctness ∈ [0..1] -> base (2 + 2*c)
 *  - latency bonus/penalty only when mostly correct (c > 0.5)
 *    and when quantiles available (per-user/per-deck)
 *  - confidence tweak ±0.15 max (small)
 *  - guessed caps grade at 3.0
 */
export function gradeFromOutcome(
  o: ReviewOutcome,
  latencyQ?: LatencyQuantiles
): number {
  // Normalize correctness from boolean|number|undefined -> [0..1]
  const cAny = o.correctness ?? o.correct ?? 0;
  const cNum = typeof cAny === "boolean" ? (cAny ? 1 : 0) : Number(cAny);
  const c = clamp(cNum, 0, 1);

  // Base from correctness: incorrect=2, correct=4, partial between
  let g = 2 + 2 * c;

  // Personalized latency signal (only if mostly correct)
  const timeMs = o.timeMs ?? o.responseMs;
  if (c > 0.5 && timeMs != null && latencyQ && latencyQ.n >= 20) {
    const t = timeMs;
    // Bonus if faster than user's own 25th percentile; small penalty if slower than 75th
    if (t <= latencyQ.p25) g += 0.4;
    else if (t >= latencyQ.p75) g -= 0.2;
    // Middle region: no change — effortful-but-successful is fine.
  } else {
    // Backward-compat legacy timing rule (optional, very light)
    if (c > 0.5 && o.timeMs != null) {
      if (o.timeMs < 2000) g += 0.25;
      else if (o.timeMs > 8000) g -= 0.15;
    }
  }

  // Confidence tweak — tiny nudge only
  if (typeof o.confidence === "number") {
    // n ∈ [0..1]
    const n = clamp(o.confidence / 3, 0, 1);
    g += 0.3 * (n - 0.5); // range [-0.15 .. +0.15]
  }

  // Guessed items can't schedule too far
  if (o.guessed) g = Math.min(g, 3);

  return clamp(g, 0, 5);
}

/////////////////////////////
// Core SM‑2 review update
/////////////////////////////

const EF_MIN = 1.3;
const EF_MAX = 2.8;

function sm2EfUpdate(ef: number, grade: number): number {
  // Standard SM-2 continuous EF update
  const newEf =
    ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  return clamp(newEf, EF_MIN, EF_MAX);
}

function retentionScale(retentionTarget?: number): number {
  // Gentle scaling: map R* around 0.90 into ~[0.95, 1.05]
  // e.g., 0.85 => 0.95; 0.95 => 1.05
  const R = retentionTarget ?? 0.90;
  return clamp(1 + (R - 0.90) * 1.0, 0.90, 1.10);
}

function applyFuzz(days: number, isSubDay: boolean): number {
  // Keep sub-day steps crisp; fuzz only day-scale intervals
  if (isSubDay) return days;
  return days * randRange(0.9, 1.1);
}

function isNonTrivialInterval(prev?: Partial<SRSState> | null): boolean {
  if (!prev) return false;
  return (prev.intervalDays ?? 0) >= 2; // treat ≥2d as "non-trivial"
}

export function defaultState(now: ISODateString): SRSState {
  return {
    ef: 2.5,
    reps: 0,
    intervalDays: 0,
    nextDueIso: now,
    history: [],
    lapses: 0,
    stability: 1.0,
    difficulty: clamp((5 - 2.5) / (5 - EF_MIN), 0, 1),
    relearnStage: null,
    retentionTarget: 0.90,
  };
}

export function createDefaultSRSState(): SRSState {
  return defaultState(new Date().toISOString());
}

/**
 * sm2Review
 * Core SM‑2 update with relearn ladder, fuzz, retention scaling, and FSRS‑lite signals.
 * - grade < 3 → failure. If prior interval non-trivial, start/continue relearn ladder.
 * - grade ≥ 3 → success. Progress ladder or normal SM‑2 schedule.
 */
export function sm2Review(
  prev: Partial<SRSState> | null,
  grade: number,
  nowIsoParam?: string
): SRSState {
  const now = nowIsoParam ?? nowIso();
  // Merge defaults with whatever prev has (supports legacy states missing fields)
  const state: SRSState = { ...defaultState(now), ...(prev as object) };

  // Append to history early for auditability
  state.history = [...(state.history ?? []), { ts: now, grade }];

  let ef = state.ef ?? 2.5;
  let reps = state.reps ?? 0;
  let intervalDays = state.intervalDays ?? 0;
  let relearnStage = state.relearnStage ?? null;
  let lapses = state.lapses ?? 0;
  let stability = state.stability ?? 1.0;
  const Rscale = retentionScale(state.retentionTarget);

  const failure = grade < 3;

  // === Failure path ===
  if (failure) {
    // Lapse if item had a non-trivial interval; otherwise treat like an early-learning miss.
    const lapse = isNonTrivialInterval(prev) || (relearnStage !== null);
    if (lapse) lapses += 1;

    // EF small decrement on lapse
    if (lapse) ef = clamp(ef - 0.2, EF_MIN, EF_MAX);

    // Stability takes a hit on lapse
    stability = Math.max(0.5, stability * (lapse ? 0.80 : 0.90));

    // Reps reset to 0 after a miss (SM‑2 convention), but we keep stability and lapses
    reps = 0;

    // Start or continue relearn ladder
    if (relearnStage == null) {
      relearnStage = lapse ? 0 : 1; // if not a true lapse, skip the 20min step
    } else {
      relearnStage = Math.max(0, relearnStage); // remain in ladder
    }

    // Ladder schedule
    let nextDueIso: ISODateString;
    if (relearnStage === 0) {
      intervalDays = 20 / (60 * 24); // 20 minutes
      nextDueIso = addMinutes(now, 20);
    } else if (relearnStage === 1) {
      intervalDays = 1;
      nextDueIso = addDays(now, 1);
    } else if (relearnStage === 2) {
      intervalDays = 3;
      nextDueIso = addDays(now, 3);
    } else {
      // stage >= 3 keeps you on 7 days until a success exits ladder
      intervalDays = 7;
      nextDueIso = addDays(now, 7);
    }

    return {
      ...state,
      ef,
      reps,
      intervalDays,
      nextDueIso,
      relearnStage,
      lapses,
      stability,
      difficulty: clamp((5 - ef) / (5 - EF_MIN), 0, 1),
      history: state.history,
    };
  }

  // === Success path ===
  // If in relearn ladder, climb it; exit after stage 3
  if (relearnStage != null) {
    let nextDueIso: ISODateString;

    if (relearnStage === 0) {
      // Move to +1 day
      relearnStage = 1;
      intervalDays = 1;
      nextDueIso = addDays(now, 1);
    } else if (relearnStage === 1) {
      // Move to +3 days
      relearnStage = 2;
      intervalDays = 3;
      nextDueIso = addDays(now, 3);
    } else if (relearnStage === 2) {
      // Move to +7 days
      relearnStage = 3;
      intervalDays = 7;
      nextDueIso = addDays(now, 7);
    } else {
      // Exit ladder and rejoin main schedule on next success
      relearnStage = null;
      // Treat this like reps==1 success to avoid giant leaps
      reps = 1;
      ef = sm2EfUpdate(ef, grade);
      // Stability increases with successful spaced recall; weight by log of interval
      stability = stability + 0.10 * Math.log2(1 + Math.max(1, state.intervalDays || 1));
      intervalDays = 1 * Rscale;
      intervalDays = applyFuzz(intervalDays, false);
      const nextDueIso2 = addDays(now, Math.max(1, Math.round(intervalDays)));
      return {
        ...state,
        ef,
        reps,
        intervalDays,
        nextDueIso: nextDueIso2,
        relearnStage,
        lapses,
        stability,
        difficulty: clamp((5 - ef) / (5 - EF_MIN), 0, 1),
        history: state.history,
      };
    }

    // While still in ladder, EF can still gently move on success
    ef = sm2EfUpdate(ef, grade);
    stability = stability + 0.06 * Math.log2(1 + Math.max(1, intervalDays));

    return {
      ...state,
      ef,
      reps, // keep reps unchanged until exit; avoids misreporting streak
      intervalDays,
      nextDueIso,
      relearnStage,
      lapses,
      stability,
      difficulty: clamp((5 - ef) / (5 - EF_MIN), 0, 1),
      history: state.history,
    };
  }

  // Normal SM‑2 success scheduling
  reps = (state.reps ?? 0) + 1;

  let nextIntervalDays: number;
  if (reps === 1) nextIntervalDays = 1;
  else if (reps === 2) nextIntervalDays = 6;
  else nextIntervalDays = (state.intervalDays || 6) * ef;

  // EF update with the earned grade
  ef = sm2EfUpdate(ef, grade);

  // Apply gentle retention scaling & fuzz (days only)
  nextIntervalDays = Math.max(1 / 24, nextIntervalDays * Rscale); // never below 1h globally
  nextIntervalDays = applyFuzz(nextIntervalDays, nextIntervalDays < 1);

  // Stability increases with success; bigger jumps for larger intervals, diminishing returns
  stability = stability + 0.08 * Math.log2(1 + Math.max(1, nextIntervalDays));

  // Next due: day-granularity for normal path; floor at 1 day for mature items
  const isSubDay = nextIntervalDays < 1;
  const nextDueIso = isSubDay
    ? addMinutes(now, Math.round(nextIntervalDays * 24 * 60))
    : addDays(now, Math.max(1, Math.round(nextIntervalDays)));

  return {
    ...state,
    ef,
    reps,
    intervalDays: nextIntervalDays,
    nextDueIso,
    relearnStage: null,
    lapses,
    stability,
    difficulty: clamp((5 - ef) / (5 - EF_MIN), 0, 1),
    history: state.history,
  };
}

/////////////////////////////
// Optional helpers (hooks)
/////////////////////////////

/**
 * roughDifficulty
 * Convenience helper to compute a normalized difficulty signal from EF.
 * 0 = easy, 1 = hard.
 */
export function roughDifficultyFromEf(ef: number): number {
  return clamp((5 - ef) / (5 - EF_MIN), 0, 1);
}

/**
 * seedLatencyQuantiles
 * Tiny helper to initialize quantiles if you collect per-user/per-deck timings.
 */
export function seedLatencyQuantiles(p25: number, p50: number, p75: number): LatencyQuantiles {
  const now = nowIso();
  return { p25, p50, p75, n: 20, updatedAtIso: now };
}
