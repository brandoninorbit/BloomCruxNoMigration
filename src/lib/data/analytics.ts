import { getSupabaseClient } from "@/lib/supabase/browserClient";
import type { MissionAttempt, BloomMastery } from "@/types";

// Tree-shakeable, narrow exports. No side effects.

export async function getDeckAttempts(deckId: number, days = 30): Promise<MissionAttempt[]> {
  const sb = getSupabaseClient();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("user_deck_mission_attempts")
    .select("deck_id, ended_at, bloom_level, score_pct, cards_seen, cards_correct")
    .eq("deck_id", deckId)
    .gte("ended_at", cutoff)
    .order("ended_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as MissionAttempt[];
}

export async function getUserAttempts(days = 30): Promise<MissionAttempt[]> {
  const sb = getSupabaseClient();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("user_deck_mission_attempts")
    .select("deck_id, ended_at, bloom_level, score_pct, cards_seen, cards_correct")
    .gte("ended_at", cutoff)
    .order("ended_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as MissionAttempt[];
}

export async function getBloomMastery(deckId: number): Promise<BloomMastery[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("user_deck_bloom_mastery")
    .select("deck_id, bloom_level, mastery_pct")
    .eq("deck_id", deckId);
  if (error) return [];
  return (data ?? []) as BloomMastery[];
}
