import type { DeckBloomLevel } from "@/types/deck-cards";
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the admin supabase client so tests run offline.
const inMemoryDB: Record<string, unknown> = {};

vi.mock('@/lib/supabase/server', () => {
  return {
    supabaseAdmin: () => {
      function makeChain(table: string) {
        // store query state
        const state: Record<string, unknown> = { table };
        type Chain = {
          select: (sel?: string) => Chain;
          eq: (col: string, val: unknown) => Chain;
          maybeSingle: () => Promise<{ data: unknown | null }>; 
          upsert: (payload: Record<string, unknown>, opts?: unknown) => Promise<{ data: unknown | null; error: unknown | null }>;
        };
        const chain: Chain = {
          select: (_sel?: string) => {
            void _sel;
            return chain;
          },
          eq: (_col: string, val: unknown) => {
            // record eqs for later matching
            const key = String(_col || 'col');
            state[key] = val;
            return chain;
          },
          maybeSingle: async () => {
            if (table === 'user_deck_quest_progress') {
              // locate by recorded user_id and deck_id
              const userId = String(state['user_id'] ?? '');
              const deckId = Number(state['deck_id'] ?? 0);
              const key = `${userId}:${deckId}`;
              const found = (inMemoryDB[key] as unknown) ?? null;
              return { data: found };
            }
            if (table === 'cards') return { data: [] };
            return { data: null };
          },
          upsert: async (payload: Record<string, unknown>, _opts?: unknown) => {
            void _opts;
            if (table === 'user_deck_quest_progress') {
              const key = `${String(payload['user_id'] ?? '')}:${Number(payload['deck_id'] ?? 0)}`;
              inMemoryDB[key] = payload;
              return { data: payload, error: null };
            }
            return { data: null, error: null };
          },
        };
        return chain;
      }
      return {
        from: (table: string) => makeChain(table),
      };
    },
  };
});

import { unlockNextBloomLevel, updateQuestProgressOnComplete } from '@/server/progression/quest';

describe('quest unlock integration (mocked supabase)', () => {
  const testUser = 'test-user-quest-unlock';
  const deckId = 999999; // local test deck id
  const level = 'Understand';

  beforeEach(async () => {
    // reset in-memory DB
    for (const k of Object.keys(inMemoryDB)) delete inMemoryDB[k];
  });

  it('marks cleared true when score >= pass threshold and all missions completed', async () => {
    // call the functions as the route would
    // For a single-mission level (totalMissions = 1), completing with 83% should mark as cleared
    const key = `${testUser}:${deckId}`;
    
    // Set up initial state with totalMissions=1 (single mission level)
    const initialData = {
      user_id: testUser,
      deck_id: deckId,
      per_bloom: {
        [level]: {
          totalMissions: 1,
          missionsPassed: 0,
          totalCards: 10,
        },
      },
    };
    inMemoryDB[key] = initialData;
    
    // Complete the mission with 83% accuracy
    await updateQuestProgressOnComplete({ userId: testUser, deckId, level: level as unknown as DeckBloomLevel, scorePct: 83, cardsSeen: 10 });
    
    const row = inMemoryDB[key] as Record<string, unknown> | undefined;
    expect(row).toBeDefined();
    // per_bloom should be present and contain the level with cleared true
    const per = (row?.per_bloom ?? {}) as Record<string, Record<string, unknown>>;
    expect(Boolean(per[level]?.cleared)).toBeTruthy();
    expect(Number(per[level]?.missionsPassed)).toBe(1);
  });

  it('does NOT unlock next level when not all missions are completed', async () => {
    // Scenario: A bloom level has 3 missions total, but only 1 mission has been passed
    await updateQuestProgressOnComplete({ userId: testUser, deckId, level: level as unknown as DeckBloomLevel, scorePct: 83, cardsSeen: 10 });
    
    // Manually set totalMissions to 3 to simulate a deck with multiple missions
    const key = `${testUser}:${deckId}`;
    const currentRow = inMemoryDB[key] as Record<string, unknown> | undefined;
    if (currentRow) {
      const per = (currentRow.per_bloom ?? {}) as Record<string, Record<string, unknown>>;
      per[level] = {
        ...(per[level] || {}),
        totalMissions: 3,
        missionsPassed: 1, // Only 1 of 3 missions passed
      };
      currentRow.per_bloom = per;
      inMemoryDB[key] = currentRow;
    }
    
    // Try to unlock - it should NOT unlock because not all missions are passed
    await unlockNextBloomLevel(testUser, deckId, level as unknown as DeckBloomLevel);
    
    const row = inMemoryDB[key] as Record<string, unknown> | undefined;
    const per = (row?.per_bloom ?? {}) as Record<string, Record<string, unknown>>;
    // cleared should NOT be set to true
    expect(Boolean(per[level]?.cleared)).toBeFalsy();
  });

  it('unlocks next level only when ALL missions are completed', async () => {
    // Scenario: A bloom level has 3 missions and all 3 have been passed
    const key = `${testUser}:${deckId}`;
    
    // Set initial state with 3 missions total and 3 passed
    const initialData = {
      user_id: testUser,
      deck_id: deckId,
      per_bloom: {
        [level]: {
          totalMissions: 3,
          missionsPassed: 2, // 2 of 3 passed so far
          missionsCompleted: 3,
          totalCards: 30,
          completedCards: 30,
        },
      },
    };
    inMemoryDB[key] = initialData;
    
    // Complete the third and final mission with >= 60%
    await updateQuestProgressOnComplete({ userId: testUser, deckId, level: level as unknown as DeckBloomLevel, scorePct: 75, cardsSeen: 10 });
    
    // Now try to unlock - it should succeed because all 3 missions are passed
    await unlockNextBloomLevel(testUser, deckId, level as unknown as DeckBloomLevel);
    
    const row = inMemoryDB[key] as Record<string, unknown> | undefined;
    const per = (row?.per_bloom ?? {}) as Record<string, Record<string, unknown>>;
    // cleared should be true because all missions are passed
    expect(Boolean(per[level]?.cleared)).toBeTruthy();
  });
});
