# Mission Card Cap

As of 2025-10-21, the mission card cap is 25.

- Source of truth: `DEFAULT_QUEST_SETTINGS.missionCap` in `src/lib/quest/types.ts`.
- Composition: `composeMission()` trims extras from blasts/review first and keeps primary selection intact.
- Progress math: All UI and server-side computations (totalMissions) read the cap from `DEFAULT_QUEST_SETTINGS`.
- Reset route: Uses the same cap when reseeding `per_bloom.totalMissions` after a deck reset.
- Backward compatibility: Existing missions are preserved as-is. Resume never re-slices `card_order`; it only filters out deleted cards.

This ensures new missions use the 25-card cap without corrupting or truncating previously created 50-card missions.
