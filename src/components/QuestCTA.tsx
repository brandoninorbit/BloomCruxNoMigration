"use client";
import { useEffect, useState } from "react";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";
import { fetchProgress, fetchMission } from "@/lib/quest/repo";
import { getSupabaseClient } from "@/lib/supabase/browserClient";

type Props = { deckId: number };

export default function QuestCTA({ deckId }: Props) {
  const [label, setLabel] = useState<string>("Begin Mission");
  const [href, setHref] = useState<string>(`/decks/${deckId}/quest`);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { progress } = await fetchProgress(deckId);
      if (!alive) return;
      if (!progress) {
        setLabel("Begin Mission");
        setHref(`/decks/${deckId}/quest`);
        return;
      }
      const allMastered = (BLOOM_LEVELS as DeckBloomLevel[]).every((lvl) => progress[lvl]?.mastered);
      if (allMastered) {
        setLabel("Restart quest");
        setHref(`/decks/${deckId}/quest`);
        return;
      }
      // First candidate: first unmastered level
      let targetLevel: DeckBloomLevel = (BLOOM_LEVELS as DeckBloomLevel[]).find((lvl) => !progress[lvl]?.mastered) ?? "Create";
      const passThreshold = DEFAULT_QUEST_SETTINGS.passThreshold;

      // Check the latest completed mission and consider advancing
      try {
        const supabase = getSupabaseClient();
        const { data: ev } = await supabase
          .from("user_xp_events")
          .select("event_type, bloom_level, payload, created_at")
          .eq("deck_id", deckId)
          .order("created_at", { ascending: false })
          .limit(50);
        const latestCompleted = (ev ?? []).find((e) => e.event_type === "mission_completed");
        if (latestCompleted) {
          const lvl = String(latestCompleted.bloom_level || targetLevel) as DeckBloomLevel;
          const p = (latestCompleted.payload ?? {}) as Record<string, unknown>;
          const percent = typeof p["percent"] === "number" ? p["percent"] as number : Number(p["percent"] ?? 0);
          // Compute remaining missions in that level
          const prog = progress[lvl];
          const totalCards = prog?.totalCards ?? 0;
          const cap = DEFAULT_QUEST_SETTINGS.missionCap;
          const totalMissions = Math.ceil(totalCards / cap) || 0;
          const doneMissions = prog?.missionsPassed ?? prog?.missionsCompleted ?? 0;
          const hasMoreMissions = doneMissions < totalMissions;
          if (percent >= passThreshold) {
            if (!hasMoreMissions) {
              const idx = BLOOM_LEVELS.indexOf(lvl);
              if (idx >= 0 && idx + 1 < BLOOM_LEVELS.length) {
                targetLevel = BLOOM_LEVELS[idx + 1] as DeckBloomLevel;
              }
            } else {
              targetLevel = lvl; // advance within same level
            }
          } else {
            targetLevel = lvl; // stay to improve
          }
        }
      } catch {
        // ignore analytics lookup issues; fall back to targetLevel
      }

  const mi = progress[targetLevel]?.missionsPassed ?? progress[targetLevel]?.missionsCompleted ?? 0;
      const mission = await fetchMission(deckId, targetLevel, mi);
      if (!alive) return;
      const inProgress = !!mission && mission.answered.length < mission.cardOrder.length;

      // Check if the target level is completed
      const levelProgress = progress[targetLevel];
      const totalCards = levelProgress?.totalCards ?? 0;
      const cap = DEFAULT_QUEST_SETTINGS.missionCap;
      const totalMissions = Math.ceil(totalCards / cap) || 0;
  const missionsCompleted = levelProgress?.missionsCompleted ?? 0; // for history
  const missionsPassed = levelProgress?.missionsPassed ?? missionsCompleted;
  const isLevelCompleted = totalMissions > 0 && missionsPassed >= totalMissions;

      // Decide label: Try again if last mission failed
      let failedLast = false;
      try {
        const supabase = getSupabaseClient();
        const { data: ev } = await supabase
          .from("user_xp_events")
          .select("event_type, bloom_level, payload, created_at, deck_id")
          .eq("deck_id", deckId)
          .order("created_at", { ascending: false })
          .limit(50);
        const latestCompleted = (ev ?? []).find((e) => e.event_type === "mission_completed" && e.deck_id === deckId);
        if (latestCompleted) {
          const p = (latestCompleted.payload ?? {}) as Record<string, unknown>;
          const percent = typeof p["percent"] === "number" ? p["percent"] as number : Number(p["percent"] ?? 0);
          const lvl = String(latestCompleted.bloom_level || targetLevel) as DeckBloomLevel;
          // Show Try again only if the failure was on the same level we're targeting now
          failedLast = percent < passThreshold && lvl === targetLevel;
        }
      } catch {
        // ignore
      }

      if (inProgress) {
        setLabel(`Resume ${targetLevel} Quest`);
        setHref(`/decks/${deckId}/quest?level=${encodeURIComponent(targetLevel)}`);
      }
      else if (isLevelCompleted) {
        setLabel(`Restart ${targetLevel} Mission`);
        setHref(`/decks/${deckId}/quest?level=${encodeURIComponent(targetLevel)}&restart=1`);
      }
      else if (failedLast) {
        setLabel(`Try ${targetLevel} again`);
        setHref(`/decks/${deckId}/quest?level=${encodeURIComponent(targetLevel)}`);
      }
      else {
        setLabel(`Continue quest: ${targetLevel}`);
        setHref(`/decks/${deckId}/quest?level=${encodeURIComponent(targetLevel)}`);
      }
    })();
    return () => { alive = false; };
  }, [deckId]);

  return (
    <a href={href} className="mt-auto w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-center hover:bg-blue-700 transition-colors block">{label}</a>
  );
}
