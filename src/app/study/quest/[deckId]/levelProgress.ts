import { aggregateBloomLevel, graduationCheck } from "@/lib/mastery";
import type { CardMastery } from "@/types/mastery";
import { Bloom } from "@/lib/bloom";

export function getBloomLevelProgress(bloom: Bloom, cardStates: CardMastery[]) {
  const agg = aggregateBloomLevel(bloom, cardStates);
  const grad = graduationCheck(agg, cardStates);
  return { meanM: agg.meanM, weakShare: agg.weakShare, ok: grad.ok, reasons: grad.reasons };
}
