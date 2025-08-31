// src/server/mastery/updateBloomMastery.ts
import type { DeckBloomLevel } from "@/types/deck-cards";
import { supabaseAdmin } from "@/lib/supabase/server";

export const HALF_LIFE_DAYS = 7;
export const SESSION_WINDOW_MINUTES = 20;
const MIN_COVERAGE_THRESHOLD = 0.05;
const MAX_COVERAGE_PER_ATTEMPT = 0.5;

/**
 * Calculate Attempt-Weighted Accuracy (AWA) for a bloom level
 * AWA = weighted average of past mission accuracies, weighted by:
 * - Coverage (unique cards seen / total cards in bloom)
 * - Recency (exponential decay with 7-day half-life)
 * - Session bundling (group attempts within 20 minutes)
 */
async function calculateAttemptWeightedAccuracy(
  userId: string,
  deckId: number,
  bloomLevel: DeckBloomLevel,
  cardIds: number[]
): Promise<number> {
  const sb = supabaseAdmin();
  const totalCards = cardIds.length;
  if (totalCards === 0) return 0;

  // Get recent mission attempts for this bloom (last 60 days)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const attemptsRes = await sb
    .from("user_deck_mission_attempts")
    .select("id, cards_seen, cards_correct, score_pct, breakdown, ended_at, started_at")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("bloom_level", bloomLevel)
    .gte("ended_at", sixtyDaysAgo)
    .order("ended_at", { ascending: false });

  if (attemptsRes.error) return 0;

  const attempts = attemptsRes.data ?? [];
  if (attempts.length === 0) return 0;

  // Group attempts into sessions (within 20 minutes)
  const sessions: Array<{
    attempts: typeof attempts;
    startTime: Date;
    endTime: Date;
  }> = [];

  for (const attempt of attempts) {
    const attemptTime = new Date(attempt.ended_at);
    let foundSession = false;

    for (const session of sessions) {
      const timeDiff = Math.abs(attemptTime.getTime() - session.endTime.getTime());
      if (timeDiff <= SESSION_WINDOW_MINUTES * 60 * 1000) {
        session.attempts.push(attempt);
        session.startTime = new Date(Math.min(session.startTime.getTime(), attemptTime.getTime()));
        session.endTime = new Date(Math.max(session.endTime.getTime(), attemptTime.getTime()));
        foundSession = true;
        break;
      }
    }

    if (!foundSession) {
      sessions.push({
        attempts: [attempt],
        startTime: attemptTime,
        endTime: attemptTime,
      });
    }
  }

  // Calculate weighted accuracy for each session
  let totalWeight = 0;
  let weightedSum = 0;
  const now = new Date();

  for (const session of sessions) {
    // Calculate session coverage and accuracy
    const uniqueCardsSeen = new Set<number>();
    let totalCorrect = 0;
    let totalSeen = 0;
    let sessionAccuracy = 0;

    for (const attempt of session.attempts) {
      // Extract cards seen from breakdown or use aggregate
      if (attempt.breakdown && typeof attempt.breakdown === 'object') {
        const breakdown = attempt.breakdown as Record<string, { cardsSeen?: number; cardsCorrect?: number }>;
        if (breakdown[bloomLevel]) {
          const bloomData = breakdown[bloomLevel];
          const seen = Math.max(0, Math.floor(Number(bloomData.cardsSeen ?? 0)));
          const correct = Math.max(0, Math.floor(Number(bloomData.cardsCorrect ?? 0)));
          totalSeen += seen;
          totalCorrect += correct;
          // For coverage, we'd need card-level data, but for now use seen count as proxy
          for (let i = 0; i < Math.min(seen, totalCards); i++) {
            uniqueCardsSeen.add(i); // Simplified - in reality would need actual card IDs
          }
        }
      } else {
        // Fallback to aggregate data
        totalSeen += Math.max(0, Math.floor(Number(attempt.cards_seen ?? 0)));
        totalCorrect += Math.max(0, Math.floor(Number(attempt.cards_correct ?? 0)));
      }
    }

    if (totalSeen === 0) continue;

    // Calculate session metrics
    sessionAccuracy = totalCorrect / totalSeen;
    const coverage = Math.min(uniqueCardsSeen.size / totalCards, MAX_COVERAGE_PER_ATTEMPT);

    // Skip tiny sessions unless they're recent
    if (coverage < MIN_COVERAGE_THRESHOLD) {
      const daysSince = (now.getTime() - session.endTime.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince > 1) continue; // Only keep very recent tiny sessions
    }

    // Time decay weight
    const daysSince = (now.getTime() - session.endTime.getTime()) / (24 * 60 * 60 * 1000);
    const timeWeight = Math.pow(0.5, daysSince / HALF_LIFE_DAYS);

    // Final weight
    const weight = timeWeight * coverage;

    totalWeight += weight;
    weightedSum += weight * sessionAccuracy;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Public wrapper to compute Attempt-Weighted Accuracy (0..1) for a user/deck/bloom.
 * This uses the same internal logic as mastery updates to ensure 1:1 parity with UI/API.
 */
export async function getAttemptWeightedAccuracy(
  userId: string,
  deckId: number,
  bloomLevel: DeckBloomLevel
): Promise<number> {
  const sb = supabaseAdmin();
  const cardsRes = await sb
    .from("cards")
    .select("id")
    .eq("deck_id", deckId)
    .eq("bloom_level", bloomLevel);
  const cardIds = (cardsRes.data ?? []).map((r) => Number(r.id));
  return calculateAttemptWeightedAccuracy(userId, deckId, bloomLevel, cardIds);
}

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

  // Collect card IDs in this deck + bloom
  const cardsRes = await sb
    .from("cards")
    .select("id")
    .eq("deck_id", deckId)
    .eq("bloom_level", bloomLevel);
  const cardIds = (cardsRes.data ?? []).map((r) => Number(r.id));
  const totalCards = cardIds.length || 0;

  // Calculate retention (existing SRS-based method)
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

    // Retention calculation (unchanged)
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

  // Calculate Attempt-Weighted Accuracy (AWA)
  const attemptWeightedAccuracy = await calculateAttemptWeightedAccuracy(userId, deckId, bloomLevel, cardIds);

  // NEW MASTERY FORMULA: 0.6 × Retention + 0.4 × AttemptWeightedAccuracy
  const retention_component = retention_strength * 100; // Convert to percentage
  const awa_component = attemptWeightedAccuracy * 100; // Convert to percentage
  const mastery_raw = 0.6 * retention_component + 0.4 * awa_component;
  const mastery_pct = Math.max(0, Math.min(100, Math.round(mastery_raw)));

  // Update EWMA for backwards compatibility (though not used in new formula)
  const prevEwma = typeof prev?.correctness_ewma === "number" ? prev.correctness_ewma : 0;
  const alpha = 0.4;
  const correctness_ewma = alpha * lastScorePct + (1 - alpha) * prevEwma;

  if (prev?.id) {
    await sb
      .from("user_deck_bloom_mastery")
      .update({
        correctness_ewma,
        retention_strength,
        coverage,
        mastery_pct,
        updated_at: new Date().toISOString()
      })
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
