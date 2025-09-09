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

  it('marks cleared true when score >= pass threshold', async () => {
    // call the functions as the route would
    await updateQuestProgressOnComplete({ userId: testUser, deckId, level: level as unknown as DeckBloomLevel, scorePct: 83, cardsSeen: 10 });
    await unlockNextBloomLevel(testUser, deckId, level as unknown as DeckBloomLevel);

    const key = `${testUser}:${deckId}`;
    const row = inMemoryDB[key] as Record<string, unknown> | undefined;
    expect(row).toBeDefined();
    // per_bloom should be present and contain the level with cleared true
    const per = (row?.per_bloom ?? {}) as Record<string, Record<string, unknown>>;
    expect(Boolean(per[level]?.cleared)).toBeTruthy();
  });
});
