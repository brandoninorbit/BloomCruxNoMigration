import { getSupabaseClient } from '@/lib/supabase/browserClient';
import type { DeckBloomLevel } from '@/types/deck-cards';

const supabase = getSupabaseClient();

export type QuestUnlockBasis =
  | 'recent_attempt'
  | 'composite_coverage_100_mean'
  | 'composite_coverage_100_latest';

export interface QuestUnlockScore {
  basis: QuestUnlockBasis;
  highestQuestScorePct: number | null;
  recentScorePct: number | null;
  compositeScorePct: number | null;
  chosenScorePct: number; // 0..100
  coverage: {
    seen: number;
    total: number;
    isFull: boolean;
  };
}

export async function getQuestUnlockScore(
  userId: string,
  deckId: number,
  bloom: DeckBloomLevel,
  strategy: 'mean' | 'latest' = 'mean'
): Promise<QuestUnlockScore> {
  // Get highest quest attempt score (not just most recent)
  const { data: highestAttempt } = await supabase
    .from('user_deck_mission_attempts')
    .select('score_pct')
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .eq('bloom_level', bloom)
    .eq('mode', 'quest')
    .order('score_pct', { ascending: false })
    .limit(1)
    .single();

  const highestQuestScorePct = highestAttempt?.score_pct as number | null ?? null;

  // Get most recent quest attempt for reference
  const { data: recentAttempt } = await supabase
    .from('user_deck_mission_attempts')
    .select('score_pct')
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .eq('bloom_level', bloom)
    .eq('mode', 'quest')
    .order('ended_at', { ascending: false })
    .limit(1)
    .single();

  const recentScorePct = recentAttempt?.score_pct as number | null ?? null;

  // Get composite coverage data
  const viewName = strategy === 'mean' ? 'v_unlock_basis_mean' : 'v_unlock_basis_latest';
  const { data: compositeData } = await supabase
    .from(viewName)
    .select('total_cards, seen_cards, composite_score_pct_when_coverage_100')
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .eq('bloom_level', bloom)
    .single();

  const totalCards = compositeData?.total_cards as number ?? 0;
  const seenCards = compositeData?.seen_cards as number ?? 0;
  const isFullCoverage = seenCards === totalCards;
  const compositeScorePct = isFullCoverage ? (compositeData?.composite_score_pct_when_coverage_100 as number | null) : null;

  // Determine chosen score and basis
  let chosenScorePct: number;
  let basis: QuestUnlockBasis;

  if (compositeScorePct !== null && highestQuestScorePct !== null && compositeScorePct > highestQuestScorePct) {
    // Use composite score only if it's higher than the highest quest attempt
    chosenScorePct = compositeScorePct;
    basis = strategy === 'mean' ? 'composite_coverage_100_mean' : 'composite_coverage_100_latest';
  } else if (highestQuestScorePct !== null) {
    // Use highest quest attempt score
    chosenScorePct = highestQuestScorePct;
    basis = 'recent_attempt';
  } else if (compositeScorePct !== null) {
    // Fall back to composite score if no quest attempts exist
    chosenScorePct = compositeScorePct;
    basis = strategy === 'mean' ? 'composite_coverage_100_mean' : 'composite_coverage_100_latest';
  } else {
    // No scores available
    chosenScorePct = 0;
    basis = 'recent_attempt';
  }

  return {
    basis,
    highestQuestScorePct: highestQuestScorePct as number | null,
    recentScorePct: recentScorePct as number | null,
    compositeScorePct: compositeScorePct as number | null,
    chosenScorePct,
    coverage: {
      seen: seenCards,
      total: totalCards,
      isFull: isFullCoverage,
    },
  };
}

export async function shouldUnlockQuest(
  userId: string,
  deckId: number,
  bloom: DeckBloomLevel,
  passThresholdPct: number = 65,
  strategy: 'mean' | 'latest' = 'mean'
): Promise<boolean> {
  const result = await getQuestUnlockScore(userId, deckId, bloom, strategy);
  return result.chosenScorePct >= passThresholdPct;
}
