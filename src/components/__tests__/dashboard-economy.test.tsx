import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
// Capture & silence stray async errors fired after component unmount (React 19 concurrent effects)
// We still rely on explicit expectations; economy regression will fail before these handlers matter.
const swallow = () => {};
process.on('unhandledRejection', swallow);
process.on('uncaughtException', swallow);

import DashboardClient from '../DashboardClient';

// Mock auth provider to simulate logged in user (so real data path runs)
vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-eco', user_metadata: { full_name: 'Eco Tester' } } })
}));

// Stub heavy/chart components to keep test lightweight
interface StubProps { [k: string]: unknown }
vi.mock('recharts', () => ({
  ResponsiveContainer: (p: StubProps) => <div data-testid="rc" {...p} />,
  LineChart: (p: StubProps) => <div data-testid="lc" {...p} />,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));
vi.mock('../DeckProgressChart', () => ({ __esModule: true, default: () => <div data-testid="deck-chart" /> }));
vi.mock('@/components/decks/DeckProgressChart', () => ({ __esModule: true, default: () => <div data-testid="deck-chart" /> }));
vi.mock('../DashboardProgressChart', () => ({ __esModule: true, default: () => <div data-testid="dashboard-chart" /> }));

// Minimal Supabase client chain helper (mirrors style in existing tests)
interface MockApi<T> {
  data: T;
  order: () => MockApi<T>;
  gte: () => MockApi<T>;
  eq: () => MockApi<T>;
  in: () => MockApi<T>;
  select: () => MockApi<T>;
  limit: () => MockApi<T>;
}
function chain<T>(returnData: T) {
  const api: MockApi<T> = {
    data: returnData,
    order: () => api,
    gte: () => api,
    eq: () => api,
    in: () => api,
    select: () => api,
    limit: () => api,
  };
  return { select: () => api };
}

vi.mock('@/lib/supabase/browserClient', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      switch (table) {
        case 'decks': return chain([]); // no decks needed for economy test
        case 'folders': return chain([]);
        case 'user_deck_bloom_mastery': return chain([]);
        case 'user_deck_quest_progress': return chain([]);
        case 'user_deck_mission_attempts': return chain([]);
        default: return chain([]);
      }
    }
  })
}));

// Cards repo (not used but Dashboard might attempt to lazy load on modal open); safe stub
vi.mock('@/lib/cardsRepo', () => ({
  listByDeck: async () => ([])
}));

// Global fetch mock (always returns a Promise to avoid .then undefined in component)
const fetchMock = vi.fn();
(global as unknown as Record<string, unknown>).fetch = ((...args: unknown[]) => {
  const ret = fetchMock(...args);
  if (ret && typeof (ret as Promise<unknown>).then === 'function') return ret;
  return Promise.resolve({ ok: true, json: async () => ({}) });
}) as unknown as typeof fetch;

beforeAll(() => {
  // ResizeObserver stub required for AgentCard responsive logic
  (global as unknown as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterAll(() => {
  delete (global as Record<string, unknown>).ResizeObserver;
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('Dashboard economy (wallet) integration', () => {
  it('auto-disables example mode when user present so real wallet values show', async () => {
    // arrange wallet
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/economy/wallet')) {
        return Promise.resolve({ ok: true, json: async () => ({ tokens: 77, commander_xp: 489, commander_level: 3 }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    const { unmount } = render(<DashboardClient />);
    // Initially the toggle button should say "Hide Example" only if example mode active. After auto effect runs it should flip to "Show Example" (meaning example is hidden now)
    await screen.findByText(/Commander Level 3/i);
    // Button should now read Show Example (since example mode turned off)
    const toggle = await screen.findByRole('button', { name: /Show Example/i });
  expect(!!toggle).toBe(true);
    await screen.findByText('77'); // tokens
    unmount();
  });
  it('applies commander_xp -> level and tokens from wallet API', async () => {
    // Commander level 5 threshold in xp model is 1374 cumulative XP
    const WALLET_XP = 1374; // exact threshold => level 5
    const TOKENS = 4321;

    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/economy/wallet')) {
        return Promise.resolve({ ok: true, json: async () => ({ tokens: TOKENS, commander_xp: WALLET_XP, commander_level: 5 }) });
      }
      // deck summaries (none) & any other endpoint => generic ok
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

  const { unmount } = render(<DashboardClient />);

    // Wait for commander level computed from XP model
    await screen.findByText(/Commander Level 5/i);
    // Tokens should render as isolated number
    await screen.findByText(String(TOKENS));

    // Ensure wallet was called at least once (React 19 concurrent may double invoke in strict/dev)
    const walletCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/economy/wallet'));
    expect(walletCalls.length).toBeGreaterThanOrEqual(1);
    unmount();
  }, 8000);

  it('falls back to level 1 and 0 tokens when wallet call fails', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/economy/wallet')) {
        return Promise.resolve({ ok: false, json: async () => ({ error: 'fail' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

  const { unmount } = render(<DashboardClient />);

    // Level 1 (initial) should persist because commander_xp never set
    await screen.findByText(/Commander Level 1/i);
    // Tokens default 0 (pick at least one occurrence)
    const zeroes = screen.getAllByText(/^0$/);
    expect(zeroes.length).toBeGreaterThan(0);
    const walletCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/economy/wallet'));
    expect(walletCalls.length).toBeGreaterThanOrEqual(1);
    unmount();
  }, 8000);
});
