import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';

// We'll mock getSupabaseSession and supabaseAdmin to simulate the full
// server path: session -> supabaseAdmin -> user_economy select
vi.mock('@/app/supabase/session', () => ({
  getSupabaseSession: async () => ({ user: { id: 'test-user-123' } }),
}));

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (cols: string) => {
          mockSelect(cols);
          return {
            eq: (col: string, val: string) => {
              // Return an object with maybeSingle() which resolves to our mock row
              mockMaybeSingle(col, val);
              return {
                maybeSingle: async () => ({ data: { tokens: 123, commander_xp: 456, commander_level: 7 }, error: null }),
              };
            },
          };
        },
      };
    },
  }),
}));

describe('GET /api/economy/wallet integration (mocked supabase/session)', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockMaybeSingle.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns tokens, commander_xp, commander_level for authenticated user', async () => {
    const route = await import('@/app/api/economy/wallet/route');
    const res = await route.GET();
    // NextResponse.json returns a NextResponse object; extract its body via json()
    // But in our environment route.GET returns NextResponse directly; so call its json method if present
    // The NextResponse in test env may be a simple object; handle both
    let jsonBody: any = null;
    try {
      // @ts-ignore
      jsonBody = await res.json();
    } catch {
      // If res is already a plain object
      // @ts-ignore
      if (res && typeof res === 'object') jsonBody = (res as any).body ?? res;
    }
    expect(mockFrom).toHaveBeenCalledWith('user_economy');
    expect(mockSelect).toHaveBeenCalledWith('tokens, commander_xp, commander_level');
    expect(mockMaybeSingle).toHaveBeenCalled();
    expect(jsonBody).toMatchObject({ tokens: 123, commander_xp: 456, commander_level: 7 });
  });
});
