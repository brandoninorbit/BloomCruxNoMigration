import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordMissionAttempt } from '../progression/quest';
import type { DeckBloomLevel } from '@/types/deck-cards';

// We will mock supabaseAdmin and createServerClient used inside quest.ts so that
// recordMissionAttempt uses our mocked client capturing insert/upsert calls.

// Simple in-memory log of operations
interface Op {
  table: string;
  type: 'insert' | 'upsert' | 'select';
  payload?: unknown;
}
const ops: Op[] = [];

// Minimal builder mimicking supabase-js chain used in recordMissionAttempt
function makeBuilder(table: string) {
  return {
    insert(data: unknown) {
      ops.push({ table, type: 'insert', payload: data });
      return {
        select() { return this; },
        maybeSingle() { return Promise.resolve({ data: { id: 999 }, error: null }); }
      };
    },
    upsert(data: unknown) {
      ops.push({ table, type: 'upsert', payload: data });
      return Promise.resolve({ data: null, error: null });
    },
    select(_cols?: string) { return this; },
    eq() { return this; },
    in() { return this; },
    order() { return this; },
    gte() { return this; },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); }
  };
}

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: () => ({ from: (table: string) => makeBuilder(table) })
}));

// Mock createServerClient path inside quest.ts
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ from: (table: string) => makeBuilder(table) })
}));

// Mock logger (silence output)
vi.mock('@/lib/logger', () => ({
  info: () => {},
  error: () => {},
  makeReqId: (p: string) => `${p}-test`
}));

// Mock next/headers cookies used when constructing session-bound client
vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => undefined, set: () => {} })
}));

describe('recordMissionAttempt persistence', () => {
  beforeEach(() => { ops.length = 0; });

  const modes: Array<'quest' | 'remix' | 'drill' | 'study' | 'starred'> = ['quest','remix','drill','study','starred'];

  modes.forEach(mode => {
    it(`persists attempt + per-card answers for mode=${mode}`, async () => {
      const res = await recordMissionAttempt({
        userId: 'user-1',
        deckId: 42,
        bloomLevel: 'Remember' as DeckBloomLevel,
        scorePct: 80,
        cardsSeen: 3,
        cardsCorrect: 2,
        startedAt: new Date(Date.now()-5000).toISOString(),
        endedAt: new Date().toISOString(),
        mode,
        answers: [
          { cardId: 11, correct: 1, response: { responseMs: 1200, foo: 'bar' } },
          { cardId: 12, correct: 0, response: { responseMs: 800 } },
          { cardId: 13, correct: 0.5, response: { responseMs: 1500 } }
        ],
        breakdown: { Remember: { scorePct: 80, cardsSeen: 3, cardsCorrect: 2 } }
      });
      expect(res.ok).toBe(true);
      // Find main attempt insert
      const attemptInsert = ops.find(o => o.table === 'user_deck_mission_attempts' && o.type === 'insert');
      expect(attemptInsert).toBeTruthy();
      // Per-card answers old table
      const perCardAnswers = ops.find(o => o.table === 'user_deck_mission_card_answers');
      expect(perCardAnswers).toBeTruthy();
      // Coverage table (may exist)
      const coverage = ops.find(o => o.table === 'user_mission_attempt_cards');
      expect(coverage).toBeTruthy();
      // user_card_stats upsert
      const stats = ops.find(o => o.table === 'user_card_stats' && o.type === 'upsert');
      expect(stats).toBeTruthy();
      // Duration captured from responseMs
      if (coverage) {
        const rows = coverage.payload as Array<{ duration_ms: number | null; card_id: number; correctness: number }>;
        const dRow = rows.find(r => r.card_id === 11);
        expect(dRow?.duration_ms).toBe(1200);
      }
    });
  });
});
