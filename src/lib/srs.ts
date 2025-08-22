import { SRSState, ReviewOutcome, normalizeCorrectness } from "@/types/mastery";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Map outcome signals to SM-2 grade (0..5).
 *  Base: correct→4, incorrect→2.
 *  Adjustments:
 *   - Fast correct (<2s) +0.5; slow correct (>8s) -0.5.
 *   - Confidence: +0.5 * (conf/3 - 0.5)  // high conf nudges up, low conf down
 *   - guessed=true caps at 3 even if correct.
 */
export function gradeFromOutcome(o: ReviewOutcome): number {
  // Map correctness (0..1) to base grade: 0 -> 2, 1 -> 4, linear in between
  const c = normalizeCorrectness(o.correctness ?? o.correct);
  let g = 2 + 2 * c;
  if (o.responseMs != null) {
    if (c > 0.5 && o.responseMs < 2000) g += 0.5;
    if (c > 0.5 && o.responseMs > 8000) g -= 0.5;
  }
  if (typeof o.confidence === "number") {
    const n = o.confidence / 3; // 0..1
    g += 0.5 * (n - 0.5);
  }
  if (o.guessed && c > 0.5) g = Math.min(g, 3);
  return clamp(g, 0, 5);
}

/** Minimal SM-2: updates ef, reps, interval, nextDueIso */
export function sm2Review(prev: SRSState | null, grade: number, nowIso?: string): SRSState {
  const now = nowIso ? new Date(nowIso) : new Date();
  const state: SRSState = prev ?? {
    ef: 2.5,
    reps: 0,
    intervalDays: 0,
    nextDueIso: now.toISOString(),
    history: [],
  };

  // success threshold ~3 (OK recall). <3 resets reps.
  if (grade < 3) {
    state.reps = 0;
    state.intervalDays = 1;
  } else {
    state.reps += 1;
    if (state.reps === 1) state.intervalDays = 1;
    else if (state.reps === 2) state.intervalDays = 6;
    else state.intervalDays = Math.round(state.intervalDays * state.ef);
  }

  // EF update (SM-2): ef' = ef + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02))
  const q = 5 - grade;
  state.ef = state.ef + (0.1 - q * (0.08 + q * 0.02));
  state.ef = clamp(state.ef, 1.3, 2.8);

  // compute next due date
  const next = new Date(now);
  next.setDate(next.getDate() + Math.max(1, state.intervalDays));
  state.nextDueIso = next.toISOString();

  state.history = [...state.history, { ts: now.toISOString(), grade }];
  return state;
}
