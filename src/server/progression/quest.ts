// src/server/progression/quest.ts
import type { DeckBloomLevel } from "@/types/deck-cards";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";

export async function recordMissionAttempt(params: {
  userId: string;
  deckId: number;
  bloomLevel: DeckBloomLevel;
  scorePct: number;
  cardsSeen: number;
  cardsCorrect: number;
  startedAt?: string | null;
  endedAt?: string | null;
}): Promise<{ ok: true; attemptId?: number } | { ok: false; error: string }> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_deck_mission_attempts")
    .insert({
      user_id: params.userId,
      deck_id: params.deckId,
      bloom_level: params.bloomLevel,
      score_pct: params.scorePct,
      cards_seen: params.cardsSeen,
      cards_correct: params.cardsCorrect,
      started_at: params.startedAt ?? null,
      ended_at: params.endedAt ?? new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, attemptId: data?.id };
}

export async function unlockNextBloomLevel(userId: string, deckId: number, levelJustPassed: DeckBloomLevel): Promise<void> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("user_deck_quest_progress")
    .select("id, per_bloom")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .maybeSingle();
  const per = (data?.per_bloom ?? {}) as Record<string, Record<string, unknown>>;
  const cur = per[levelJustPassed] ?? {};
  if ((cur as Record<string, unknown>).cleared === true) return; // idempotent
  per[levelJustPassed] = { ...cur, cleared: true } as Record<string, unknown>;
  await sb
    .from("user_deck_quest_progress")
    .upsert({ user_id: userId, deck_id: deckId, per_bloom: per }, { onConflict: "user_id,deck_id" });
}

// Ensure per_bloom totals exist and aggregate mission counters on completion
export async function updateQuestProgressOnComplete(params: {
  userId: string;
  deckId: number;
  level: DeckBloomLevel;
  scorePct: number; // 0..100
  cardsSeen: number;
}): Promise<void> {
  const sb = supabaseAdmin();
  const [{ data: row }, { data: cardRows }] = await Promise.all([
    sb.from("user_deck_quest_progress").select("id, per_bloom, xp").eq("user_id", params.userId).eq("deck_id", params.deckId).maybeSingle(),
    sb
      .from("cards")
      .select("bloom_level")
      .eq("deck_id", params.deckId),
  ]);
  const cap = DEFAULT_QUEST_SETTINGS.missionCap;
  type PerBloomItem = {
    totalCards: number;
    totalMissions: number;
    completedCards: number;
    missionsCompleted: number;
    masteryPercent: number;
    mastered: boolean;
    commanderGranted: boolean;
    accuracySum: number;
    accuracyCount: number;
    recentAttempts: unknown[];
    weightedAvg: number;
    cleared: boolean;
  };
  type PerBloom = Record<DeckBloomLevel, Partial<PerBloomItem>>;
  const per = (row?.per_bloom ?? {}) as unknown as PerBloom;
  // Build a map of total cards by bloom
  const map: Record<DeckBloomLevel, number> = { Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0 };
  for (const c of (cardRows ?? []) as Array<{ bloom_level: DeckBloomLevel | null }>) {
    const lvl = (c.bloom_level ?? "Remember") as DeckBloomLevel;
    map[lvl] = (map[lvl] ?? 0) + 1;
  }
  // Ensure per_bloom has totals for all levels
  for (const lvl of BLOOM_LEVELS as DeckBloomLevel[]) {
  const cur = (per[lvl] ?? {}) as Partial<PerBloomItem>;
  const computedTotal = map[lvl] ?? 0;
  const totalCards = computedTotal > 0 ? computedTotal : Number(cur.totalCards ?? 0);
    const totalMissions = Math.ceil(totalCards / cap) || 0;
  const built: PerBloomItem = {
      totalCards,
      totalMissions,
      completedCards: Number(cur.completedCards ?? 0),
      missionsCompleted: Number(cur.missionsCompleted ?? 0),
      masteryPercent: Number(cur.masteryPercent ?? 0),
      mastered: Boolean(cur.mastered ?? false),
      commanderGranted: Boolean(cur.commanderGranted ?? false),
      accuracySum: Number(cur.accuracySum ?? 0),
      accuracyCount: Number(cur.accuracyCount ?? 0),
      recentAttempts: Array.isArray(cur.recentAttempts) ? cur.recentAttempts : [],
      weightedAvg: Number(cur.weightedAvg ?? 0),
      cleared: Boolean(cur.cleared ?? false),
    };
  per[lvl] = built;
  }
  // Update aggregates for the just-completed level
  const cur = (per[params.level] ?? {}) as Partial<PerBloomItem>;
  cur.missionsCompleted = Number(cur.missionsCompleted ?? 0) + 1;
  const before = Number(cur.completedCards ?? 0);
  const totalCards = Number(cur.totalCards ?? 0);
  cur.completedCards = Math.min(totalCards, before + Math.max(0, Number(params.cardsSeen ?? 0)));
  cur.accuracySum = Number(cur.accuracySum ?? 0) + Math.max(0, Math.min(1, (Number(params.scorePct ?? 0) / 100)));
  cur.accuracyCount = Number(cur.accuracyCount ?? 0) + 1;
  // Maintain a small recent attempts window (newest first)
  const recent = Array.isArray(cur.recentAttempts) ? [...(cur.recentAttempts as Array<{ percent: number; at: string }>)] : [];
  recent.unshift({ percent: Math.round(Math.max(0, Math.min(100, params.scorePct))), at: new Date().toISOString() });
  while (recent.length > 10) recent.pop();
  cur.recentAttempts = recent;
  // Optional weighted average for quick UI
  const weights = recent.map((_, i) => Math.pow(0.8, i));
  const denom = weights.reduce((a, b) => a + b, 0) || 1;
  const wavg = recent.reduce((s, r, i) => s + (r.percent * weights[i]), 0) / denom;
  cur.weightedAvg = Math.round(wavg);
  // Single-pass clear flag
  if ((params.scorePct ?? 0) >= 65) cur.cleared = true;
  per[params.level] = cur;
  await sb
    .from("user_deck_quest_progress")
    .upsert({ user_id: params.userId, deck_id: params.deckId, per_bloom: per, xp: row?.xp ?? {} }, { onConflict: "user_id,deck_id" });
}
