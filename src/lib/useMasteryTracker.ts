"use client";

import { getSupabaseClient } from "@/lib/supabase/browserClient";
import { updateCardMastery } from "@/lib/mastery";
import type { CardMastery, ReviewOutcome } from "@/types/mastery";
import { Bloom } from "@/lib/bloom";
import { loadUserCardState, upsertUserCardState } from "@/lib/masteryRepo";

// Minimal default state if user has no prior mastery for this card.
function defaultCardMastery(cardId: number | string, bloom: Bloom): CardMastery {
  const now = new Date().toISOString();
  return {
    cardId: String(cardId),
    bloom,
    srs: { ef: 2.5, reps: 0, intervalDays: 0, nextDueIso: now, history: [] },
    spacing: { spacedShortOk: false, spacedLongOk: false, consecutiveSpacedSuccesses: 0 },
    accuracy: { k: 6, ptr: -1, outcomes: [] },
    confidence: { ewma: 0.5, lambda: 0.6 },
    Ri: 0, Ai: 0, Ci: 0, Mi: 0,
    updatedIso: now,
  };
}

export function useMasteryTracker() {
  const supabase = getSupabaseClient();

  return async function trackAnswer(payload: {
    userId?: string; // optional override for tests
    cardId: number | string;
    bloom: Bloom;
    // New: numeric correctness 0..1 for multi-answer items. Keep legacy `correct` for callers that still send boolean.
    correctness?: number;
    correct?: boolean;
    responseMs?: number;
    confidence?: 0 | 1 | 2 | 3;
    guessed?: boolean;
    cardType?: string;
  }) {
    const userId = payload.userId || (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return; // not signed in; skip

    const prev = (await loadUserCardState(userId, Number(payload.cardId), payload.bloom))
      || defaultCardMastery(payload.cardId, payload.bloom);

    // Map incoming payload to the ReviewOutcome shape understood by the mastery pipeline.
    // If a numeric correctness is provided, include it and set the legacy `correct` only when it's fully correct (1) or fully wrong (0).
    const normalizedCorrect = typeof payload.correctness === "number" ? payload.correctness : undefined;
    let legacyCorrect: boolean | undefined = payload.correct;
    if (typeof normalizedCorrect === "number") {
      if (normalizedCorrect >= 1) legacyCorrect = true;
      else if (normalizedCorrect === 0) legacyCorrect = false;
      else legacyCorrect = undefined; // partial -> don't set legacy boolean
    }

    const outcome: ReviewOutcome = {
      correctness: normalizedCorrect,
      correct: legacyCorrect,
      responseMs: payload.responseMs,
      confidence: payload.confidence,
      guessed: payload.guessed,
      cardType: payload.cardType,
    };

    const next = updateCardMastery(prev, outcome);
    await upsertUserCardState(userId, Number(payload.cardId), next);
  };
}
