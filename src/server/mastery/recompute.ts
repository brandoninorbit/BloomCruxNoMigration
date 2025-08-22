// src/server/mastery/recompute.ts
import type { DeckBloomLevel } from "@/types/deck-cards";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { updateBloomMastery } from "@/server/mastery/updateBloomMastery";

/** Recompute mastery aggregates for all Bloom levels for a deck and user. */
export async function recomputeBloomMasteryForDeck(params: { userId: string; deckId: number }): Promise<void> {
  const { userId, deckId } = params;
  // We don't have a fresh last score here; pass lastScorePct=0 to keep EWMA biased towards prior state
  // and let retention/coverage adjust based on card set.
  const DEFAULT_LAST_SCORE = 0;
  for (const lvl of BLOOM_LEVELS as DeckBloomLevel[]) {
    try {
      await updateBloomMastery({ userId, deckId, bloomLevel: lvl, lastScorePct: DEFAULT_LAST_SCORE });
    } catch {
      // best-effort per level
    }
  }
}
