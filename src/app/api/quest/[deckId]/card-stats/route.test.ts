import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---
// Mock session util to inject user id or no-user states
vi.mock('@/app/supabase/session', () => ({
  getSupabaseSession: vi.fn(),
}));
// Mock supabase admin client
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: vi.fn(),
}));

// Module under test (import AFTER mocks so they apply to module dependency graph)
import { GET, mergeCardStats } from './route';

// Helpers to get typed mocks
import * as SessionMod from '@/app/supabase/session';
import * as ServerMod from '@/lib/supabase/server';
// Cast mocked exports
const getSupabaseSessionMock = SessionMod.getSupabaseSession as unknown as ReturnType<typeof vi.fn>;
const supabaseAdminMock = ServerMod.supabaseAdmin as unknown as ReturnType<typeof vi.fn>;

interface StatsRow { card_id: number; attempts: number; correct: number; streak: number; ease: number; interval_days: number; due_at: string | null }
interface AnswerRow { card_id: number; correct_fraction: number | null; answered_at: string | null }

function makeQueryBuilder<T>(data: T[]) {
  let eqCalls = 0;
  return {
    select() { return this; },
    eq() {
      eqCalls += 1;
      if (eqCalls >= 2) {
        return Promise.resolve({ data, error: null });
      }
      return this;
    },
  };
}

describe('GET /api/quest/[deckId]/card-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session user', async () => {
  getSupabaseSessionMock.mockResolvedValueOnce(null);
  supabaseAdminMock.mockReturnValueOnce({ from: () => ({ select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }) });
    const req = new NextRequest('http://localhost/api/quest/42/card-stats');
    // params is a Promise per route signature
    const res = await GET(req, { params: Promise.resolve({ deckId: '42' }) });
    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('aggregates stats + answers (pure mergeCardStats)', () => {
    const now = new Date().toISOString();
    const statsRows: StatsRow[] = [
      { card_id: 10, attempts: 3, correct: 2, streak: 2, ease: 2.6, interval_days: 4, due_at: now },
    ];
    const answerRows: AnswerRow[] = [
      { card_id: 10, correct_fraction: 1, answered_at: now },
      { card_id: 10, correct_fraction: 0, answered_at: new Date(Date.now() + 1000).toISOString() },
      { card_id: 11, correct_fraction: 0.5, answered_at: now },
    ];
    const merged = mergeCardStats(statsRows as any, answerRows as any);
    expect(merged.length).toBe(2);
    const byId = Object.fromEntries(merged.map(r => [r.cardId, r]));
    expect(byId[10].attempts).toBe(3);
    expect(byId[10].bestCorrectness).toBe(1);
    expect(byId[10].avgCorrectness).toBeCloseTo(0.5, 5);
    expect(byId[11].attempts).toBe(0);
    expect(byId[11].bestCorrectness).toBeCloseTo(0.5, 5);
  });

  it('returns 400 for invalid deckId', async () => {
  getSupabaseSessionMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
  supabaseAdminMock.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }) });
    const req = new NextRequest('http://localhost/api/quest/not-a-number/card-stats');
    const res = await GET(req, { params: Promise.resolve({ deckId: 'abc' }) });
    expect(res.status).toBe(400);
  });
});
