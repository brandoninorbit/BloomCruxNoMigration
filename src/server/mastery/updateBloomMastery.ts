// src/server/mastery/updateBloomMastery.ts
import type { DeckBloomLevel } from "@/types/deck-cards";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function updateBloomMastery(params: {
  userId: string;
  deckId: number;
  bloomLevel: DeckBloomLevel;
  lastScorePct: number; // 0..100
}): Promise<void> {
  const { userId, deckId, bloomLevel, lastScorePct } = params;
  const sb = supabaseAdmin();

  // Fetch existing mastery row
  const existing = await sb
    .from("user_deck_bloom_mastery")
    .select("id, correctness_ewma, retention_strength, coverage, mastery_pct")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("bloom_level", bloomLevel)
    .maybeSingle();

  const prev = existing.data ?? null;
  const prevEwma = typeof prev?.correctness_ewma === "number" ? prev.correctness_ewma : 0;
  const alpha = 0.4;
  const correctness_ewma = alpha * lastScorePct + (1 - alpha) * prevEwma;

  // Collect card IDs in this deck + bloom
  const cardsRes = await sb
    .from("cards")
    .select("id")
    .eq("deck_id", deckId)
    .eq("bloom_level", bloomLevel);
  const cardIds = (cardsRes.data ?? []).map((r) => Number(r.id));
  const totalCards = cardIds.length || 0;

  // SRS attempts for the user on these cards
  let retention_strength = 0;
  let coverage = 0;
  if (totalCards > 0 && cardIds.length > 0) {
    const srsRes = await sb
      .from("user_deck_srs")
      .select("card_id, attempts, correct")
      .eq("user_id", userId)
      .eq("deck_id", deckId)
      .in("card_id", cardIds);
    const rows = (srsRes.data ?? []) as Array<{ card_id: number; attempts: number; correct: number }>;
    const attemptedMap = new Map<number, { attempts: number; correct: number }>();
    rows.forEach((r) => attemptedMap.set(Number(r.card_id), { attempts: Number(r.attempts ?? 0), correct: Number(r.correct ?? 0) }));
    const attemptedCount = Array.from(attemptedMap.values()).filter((v) => (v.attempts ?? 0) > 0).length;
    coverage = attemptedCount / Math.max(1, totalCards);
    // Simpler retention proxy: average of per-card accuracy with floor/ceiling
    if (attemptedMap.size > 0) {
      const vals: number[] = [];
      for (const v of attemptedMap.values()) {
        if (v.attempts > 0) {
          const p = Math.max(0.2, Math.min(1, v.correct / Math.max(1, v.attempts)));
          vals.push(p);
        }
      }
      retention_strength = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    } else {
      retention_strength = 0;
    }
  }

  const mastery_raw = 0.6 * (retention_strength * 100) + 0.3 * correctness_ewma + 0.1 * (coverage * 100);
  const mastery_pct = Math.max(0, Math.min(100, Math.round(mastery_raw)));

  if (prev?.id) {
    await sb
      .from("user_deck_bloom_mastery")
      .update({ correctness_ewma, retention_strength, coverage, mastery_pct, updated_at: new Date().toISOString() })
      .eq("id", prev.id);
  } else {
    await sb
      .from("user_deck_bloom_mastery")
      .upsert({
        user_id: userId,
        deck_id: deckId,
        bloom_level: bloomLevel,
        correctness_ewma,
        retention_strength,
        coverage,
        mastery_pct,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,deck_id,bloom_level" });
  }
}
