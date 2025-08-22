import type { CardMastery } from "@/types/mastery";
import { Bloom } from "@/lib/bloom";
import { getSupabaseClient } from "@/lib/supabase/browserClient";

/** Load user's card mastery JSON state (returns null if none). */
export async function loadUserCardState(userId: string, cardId: number, _bloom?: Bloom): Promise<CardMastery | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_card_state")
    .select("state")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) return null;
  const state = (data?.state ?? null) as CardMastery | null;
  return state;
}

/** Upsert the JSON state for a given user/card. */
export async function upsertUserCardState(userId: string, cardId: number, next: CardMastery): Promise<void> {
  const supabase = getSupabaseClient();
  const row = {
    user_id: userId,
    card_id: cardId,
    bloom: next.bloom,
    state: next as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  };
  await supabase.from("user_card_state").upsert(row, { onConflict: "user_id,card_id" });
}
