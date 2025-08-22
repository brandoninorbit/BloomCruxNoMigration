import { Bloom } from "@/lib/bloom";

export type ReviewOutcome = {
  /**
   * New: numeric correctness in [0,1]. Use for multi-part cards (fraction correct).
   * Deprecated: keep `correct` for legacy boolean-only callers.
   */
  correctness?: number;
  correct?: boolean; // deprecated, kept for backward compatibility
  responseMs?: number;       // optional latency signal
  confidence?: 0 | 1 | 2 | 3; // 0=low, 3=high; optional metacognition
  guessed?: boolean;         // optional UX flag if user marked a guess
  cardType?: string;         // for Apply+ diversity checks
  nowIso?: string;           // overrideable 'now' for tests
};

// Helper: normalize correctness from number|boolean|undefined -> 0..1
export function normalizeCorrectness(x: number | boolean | undefined): number {
  if (x === true) return 1;
  if (x === false || x == null) return 0;
  if (typeof x === "number") {
    if (Number.isNaN(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }
  return 0;
}

export type SRSState = {
  // SM-2 style
  ef: number;              // easiness factor (default 2.5)
  reps: number;            // consecutive successful reviews
  intervalDays: number;    // last assigned interval
  nextDueIso: string;      // ISO timestamp next review due
  history: Array<{ ts: string; grade: number }>;
};

export type SpacingEvidence = {
  spacedShortOk: boolean;  // success after gap >= T_b/2
  spacedLongOk: boolean;   // success after gap >= T_b
  consecutiveSpacedSuccesses: number; // count of spaced successes in a row
  lastGapDays?: number;    // diagnostic only
};

export type AccuracyTrack = {
  // fixed-size ring buffer of last k outcomes; we’ll keep k<=8
  k: number;
  ptr: number;
  outcomes: (0 | 1)[];
};

export type ConfidenceTrack = {
  // EWMA of confidence (0..1) so metacognition nudges mastery
  ewma: number;
  lambda: number; // decay 0..1
};

export type CardMastery = {
  cardId: string;
  bloom: Bloom;
  srs: SRSState;
  spacing: SpacingEvidence;
  accuracy: AccuracyTrack;
  confidence: ConfidenceTrack;
  // cached signals
  Ri: number; Ai: number; Ci: number; Mi: number;
  updatedIso: string;
};

export type BloomLevelMastery = {
  bloom: Bloom;
  meanM: number;
  weakShare: number; // fraction Mi<0.60
  cards: number;
  graduationBlockedReason?: string;
};

export type GraduationCheck = {
  ok: boolean;
  reasons: string[];
};
