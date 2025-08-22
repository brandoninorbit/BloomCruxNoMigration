import { Bloom, TARGET_INTERVAL_DAYS } from "@/lib/bloom";
import {
  AccuracyTrack, BloomLevelMastery, CardMastery, GraduationCheck, ReviewOutcome, normalizeCorrectness,
} from "@/types/mastery";
import { gradeFromOutcome, sm2Review } from "@/lib/srs";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Tunables (export for A/B later)
export const WEIGHT_R = 0.5;
export const WEIGHT_A = 0.3;
export const WEIGHT_C = 0.2;

export const ACCURACY_LAMBDA = 0.7; // recency decay for A_i
export const CONF_LAMBDA = 0.6;     // recency decay for C_i

// --- helpers ---
function ewmaBinary(track: AccuracyTrack, lambda = ACCURACY_LAMBDA): number {
  // compute EWMA over outcomes with weights w_t = λ^(k - t)
  if (track.outcomes.length === 0) return 0;
  const k = track.outcomes.length;
  let num = 0, den = 0;
  for (let i = 0; i < k; i++) {
    const w = Math.pow(lambda, k - i);
    num += w * track.outcomes[i];
    den += w;
  }
  return den ? num / den : 0;
}

function ewmaScalar(prev: number, next: number, lambda = CONF_LAMBDA): number {
  // classic EWMA: y' = λ*y + (1-λ)*x
  return lambda * prev + (1 - lambda) * next;
}

// --- signals ---
/** Retention strength: normalizes next interval vs Bloom target; adds consolidation boost for spaced streaks. */
export function retentionStrength(nextIntervalDays: number, bloom: Bloom, consecutiveSpacedSuccesses = 0): number {
  const T = TARGET_INTERVAL_DAYS[bloom];
  // log2 normalization is smooth; cap 0..1
  const base = clamp01(Math.log2(nextIntervalDays + 1) / Math.log2(T + 1));
  // consolidation: diminishing boost up to +0.15 for 3+ spaced successes
  const boost = Math.min(0.15, 0.07 * consecutiveSpacedSuccesses);
  return clamp01(base + boost);
}

/** Accuracy momentum: EWMA + small 0→1 recovery bonus. */
export function accuracyMomentum(acc: AccuracyTrack, lastTwo?: [0|1,0|1]): number {
  let a = ewmaBinary(acc);
  if (lastTwo && lastTwo[0] === 0 && lastTwo[1] === 1) a = Math.min(1, a + 0.05);
  return a;
}

/** Confidence index: already stored as EWMA 0..1 */
export function confidenceIndex(ci: number): number {
  return clamp01(ci);
}

/** Per-card mastery */
export function cardMasteryMi(Ri: number, Ai: number, Ci: number): number {
  return clamp01(WEIGHT_R * Ri + WEIGHT_A * Ai + WEIGHT_C * Ci);
}

// --- update pipeline on answer ---
export function updateCardMastery(prev: CardMastery, outcome: ReviewOutcome): CardMastery {
  const nowIso = outcome.nowIso ?? new Date().toISOString();
  const grade = gradeFromOutcome(outcome);
  const c = normalizeCorrectness(outcome.correctness ?? outcome.correct);
  const nextSrs = sm2Review(prev.srs ?? null, grade, nowIso);

  // gap used for evidence (in days)
  const lastTs = prev.srs?.history.at(-1)?.ts;
  let gapDays = undefined as number | undefined;
  if (lastTs) {
    gapDays = Math.max(0, (Date.parse(nowIso) - Date.parse(lastTs)) / (1000 * 60 * 60 * 24));
  }

  const T = TARGET_INTERVAL_DAYS[prev.bloom];
  const spacedShortHit = c > 0 && gapDays !== undefined && gapDays >= T / 2;
  const spacedLongHit  = c > 0 && gapDays !== undefined && gapDays >= T;

  const spacing = {
    spacedShortOk: prev.spacing.spacedShortOk || !!spacedShortHit,
    spacedLongOk : prev.spacing.spacedLongOk  || !!spacedLongHit,
    consecutiveSpacedSuccesses:
      outcome.correct && gapDays !== undefined && gapDays >= T/2
        ? prev.spacing.consecutiveSpacedSuccesses + 1
        : 0,
    lastGapDays: gapDays,
  };

  // accuracy ring buffer update
  const acc = { ...prev.accuracy };
  // store fractional correctness in the accuracy outcomes buffer as 0..1 values
  const bitVal = c;
  if (acc.outcomes.length < acc.k) {
    // convert outcomes array to hold numeric 0/1 historically; keep type but allow numbers
    // We store either 0 or 1 or fractional but keep rounding-aware EWMA later
    (acc.outcomes as (0|1)[]).push(bitVal > 0.5 ? 1 : 0);
    acc.ptr = acc.outcomes.length - 1;
  } else {
    acc.ptr = (acc.ptr + 1) % acc.k;
    (acc.outcomes as (0|1)[])[acc.ptr] = bitVal > 0.5 ? 1 : 0;
  }
  const lastTwo: [0|1,0|1] | undefined =
    acc.outcomes.length >= 2
      ? [acc.outcomes[(acc.ptr - 1 + acc.outcomes.length) % acc.outcomes.length], acc.outcomes[acc.ptr]]
      : undefined;

  // confidence ewma update (normalize 0..1)
  const prevCi = prev.confidence.ewma ?? 0;
  const nextPoint = (typeof outcome.confidence === "number") ? outcome.confidence / 3 : (outcome.guessed ? 0 : (c > 0.5 ? 0.7 : 0.3));
  const nextCi = ewmaScalar(prevCi, nextPoint, prev.confidence.lambda);

  // compute signals
  const Ri = retentionStrength(nextSrs.intervalDays, prev.bloom, spacing.consecutiveSpacedSuccesses);
  const Ai = accuracyMomentum(acc, lastTwo);
  const Ci = confidenceIndex(nextCi);
  const Mi = cardMasteryMi(Ri, Ai, Ci);

  return {
    ...prev,
    srs: nextSrs,
    spacing,
    accuracy: acc,
    confidence: { ...prev.confidence, ewma: nextCi },
    Ri, Ai, Ci, Mi,
    updatedIso: nowIso,
  };
}

// --- aggregation & graduation ---
export function aggregateBloomLevel(bloom: Bloom, cards: CardMastery[]): BloomLevelMastery {
  const xs = cards.map(c => c.Mi);
  const meanM = xs.length ? xs.reduce((a,b)=>a+b,0) / xs.length : 0;
  const weakShare = xs.length ? cards.filter(c => c.Mi < 0.60).length / xs.length : 0;
  return { bloom, meanM, weakShare, cards: cards.length };
}

const isApplyPlus = (b: Bloom) => [Bloom.Apply, Bloom.Analyze, Bloom.Evaluate, Bloom.Create].includes(b);

/** Stub diversity check: wire actual concept/cardType grouping later. */
function hasCardTypeDiversity(_cards: CardMastery[]): boolean {
  // TODO: inject cardType grouping by concept/topic; for now return true to avoid blocking.
  return true;
}

export function graduationCheck(level: BloomLevelMastery, cards: CardMastery[]): GraduationCheck {
  const reasons: string[] = [];
  if (level.meanM < 0.80) reasons.push(`Mastery ${level.meanM.toFixed(2)} < 0.80`);
  if (level.weakShare > 0.10) reasons.push(`Weak cards ${(level.weakShare*100).toFixed(0)}% > 10%`);

  // require distributed spacing evidence on ≥80% cards
  const okSpacing = cards.filter(c => c.spacing.spacedShortOk && c.spacing.spacedLongOk).length / (cards.length || 1);
  if (okSpacing < 0.80) reasons.push(`Distributed spacing evidence ${(okSpacing*100).toFixed(0)}% < 80%`);

  if (isApplyPlus(level.bloom) && !hasCardTypeDiversity(cards)) {
    reasons.push("Insufficient card-type diversity for transfer");
  }

  return { ok: reasons.length === 0, reasons };
}
