"use client";

import { getSupabaseClient } from "@/lib/supabase/browserClient";
import type { CardMastery } from "@/types/mastery";
import type { ReviewReason } from "@/components/decks/CardReviewReasonChip";

export type CardReason = { cardId: number; reason: ReviewReason };

// Defaults
const LOW_ACC_THRESHOLD = 0.60; // 60%
const LEECH_LAPSES = 3; // reasonable default until configured elsewhere

function rollingAccuracy(acc?: CardMastery["accuracy"]): number | undefined {
  if (!acc || !Array.isArray(acc.outcomes) || acc.outcomes.length === 0) return undefined;
  const k = Math.min(acc.k ?? acc.outcomes.length, acc.outcomes.length);
  const xs = acc.outcomes.slice(-k);
  const sum = xs.reduce((s: number, v: 0 | 1) => s + v, 0);
  return sum / xs.length;
}

export function computeReason(m: CardMastery, nowIso = new Date().toISOString()): ReviewReason | null {
  // Priority: Leech > Low-Acc > Due
  const lapses = Number(m?.srs?.lapses ?? 0);
  if (lapses >= LEECH_LAPSES) return "leech";

  const acc = rollingAccuracy(m?.accuracy);
  if (acc != null && acc < LOW_ACC_THRESHOLD) return "low-acc";

  if (m?.srs?.nextDueIso && m.srs.nextDueIso <= nowIso) return "due";

  return null;
}

/**
 * fetchCardReasons
 * Loads mastery blobs for the current user and a set of card IDs, returning
 * a map of cardId -> reason (if any).
 */
export async function fetchCardReasons(cardIds: number[]): Promise<Record<number, ReviewReason>> {
  const supabase = getSupabaseClient();
  const out: Record<number, ReviewReason> = {};
  if (!cardIds.length) return out;

  // Get the current user id
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return out;
  const uid = userRes.user.id;

  // Pull all states with an IN filter for efficiency
  const { data, error } = await supabase
    .from("user_card_state")
    .select("card_id, state")
    .eq("user_id", uid)
    .in("card_id", cardIds);
  if (error) return out;

  const now = new Date().toISOString();
  for (const row of (data ?? []) as Array<{ card_id: number; state: unknown }>) {
    const mastery = row.state as CardMastery | null;
    if (!mastery) continue;
    const reason = computeReason(mastery, now);
    if (reason) out[row.card_id] = reason;
  }
  return out;
}
