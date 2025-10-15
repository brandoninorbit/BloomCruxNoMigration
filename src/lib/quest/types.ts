import type { DeckBloomLevel, DeckCard } from "@/types/deck-cards";

export type QuestSettings = {
  passThreshold: number; // percentage (0-100)
  missionCap: number; // max cards per mission before splitting
  blastsPercent: number; // percentage of total cards up to current level
};

export const DEFAULT_QUEST_SETTINGS: QuestSettings = {
  passThreshold: 60,
  missionCap: 50,
  blastsPercent: 30,
} as const;

export type MissionState = {
  deckId: number;
  bloomLevel: DeckBloomLevel;
  missionIndex: number; // 0-based index when a level splits to multiple missions
  sequenceSeed: string; // RNG seed or UUID to reshuffle deterministically
  cardOrder: number[]; // card IDs in order for this mission
  // `correct` may be boolean (legacy) or a fractional number 0..1 (preferred)
  answered: Array<{ cardId: number; correct: boolean | number; response?: unknown }>; // session answers with optional raw user response
  correctCount: number;
  startedAt: string; // ISO
  resumedAt?: string; // ISO
};

export type BloomProgress = {
  totalCards: number;
  completedCards: number;
  missionsCompleted: number;
  // Number of missions PASSED (>= passThreshold). Used for mission gating/unlocks.
  missionsPassed?: number;
  masteryPercent: number;
  mastered: boolean;
  commanderGranted: boolean; // commander XP awarded retroactively once mastered
  // tracking for averages and total missions
  accuracySum?: number; // sum of mission accuracies (0..1) for this level
  accuracyCount?: number; // number of missions counted
  totalMissions?: number; // computed from primary splits
  // progression history for unlocking
  recentAttempts?: Array<{ percent: number; at: string }>; // last N mission percents (0-100)
  weightedAvg?: number; // 0-100 weighted average of recent attempts
  cleared?: boolean; // meets unlock criteria to clear this Bloom level
};

export type UserBloomProgress = Record<DeckBloomLevel, BloomProgress>;

export type SRSPerformance = Record<number, { // keyed by cardId
  attempts: number;
  correct: number;
  lastSeenAt?: string;
}>;

export type MissionComputeInput = {
  deckId: number;
  level: DeckBloomLevel;
  allCards: DeckCard[]; // entire deck
  srs?: SRSPerformance;
  settings?: Partial<QuestSettings>;
  // Active filtering. If omitted, treats all as active.
  isActive?: (c: DeckCard) => boolean;
  activeCardIds?: number[]; // alternative to isActive
  // Optional: override review candidates using precomputed low-accuracy IDs (from mastery math)
  reviewCandidateIds?: number[];
  // Deterministic composition
  missionIndex?: number; // for split levels
  seed?: string; // custom seed for composition/shuffle
};

export type MissionSet = {
  cards: DeckCard[]; // the mission pool for current bloom mission
  blasts: DeckCard[]; // cards pulled from lower levels
  review: DeckCard[]; // SRS low performers
};

export type MissionComposition = {
  primaryIds: number[]; // selected primary slice for missionIndex
  blastsIds: number[];
  reviewIds: number[];
  missionIds: number[]; // union after trimming
  seedUsed: string;
  debug: {
    primaryCount: number;
    blastsRequested: number;
    blastsChosen: number;
    reviewRequested: number;
    reviewChosen: number;
    trimmedFromBlasts: number;
    trimmedFromReview: number;
    total: number;
  };
};

export type XpLedger = {
  bloomXp: Record<DeckBloomLevel, number>;
  commanderXp: Record<DeckBloomLevel, number>;
  commanderXpTotal: number;
  commanderGranted: Record<DeckBloomLevel, boolean>;
};
