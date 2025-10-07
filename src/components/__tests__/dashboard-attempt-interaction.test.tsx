import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardClient from '../DashboardClient';

// Mock auth provider to simulate logged in user
vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1', user_metadata: { full_name: 'Test User' } } })
}));

// Stub charts & heavy components
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
// Also mock decks/DeckProgressChart relative path used inside folders/unorganized sections
vi.mock('@/components/decks/DeckProgressChart', () => ({ __esModule: true, default: () => <div data-testid="deck-chart" /> }));
vi.mock('../DashboardProgressChart', () => ({ __esModule: true, default: () => <div data-testid="dashboard-chart" /> }));

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
        case 'decks': return chain([{ id: 1, title: 'Bio Deck', folder_id: null }]);
        case 'folders': return chain([]);
        case 'user_deck_bloom_mastery': return chain([]);
        case 'user_deck_quest_progress': return chain([]);
        case 'user_deck_mission_attempts': return chain([
          { id: 101, deck_id: 1, bloom_level: 'Remember', score_pct: 75, cards_seen: 8, cards_correct: 6, ended_at: new Date().toISOString(), mode: 'quest', breakdown: null }
        ]);
        case 'cards': return chain([]);
        case 'user_deck_srs': return chain([]);
        default: return chain([]);
      }
    }
  })
}));

// Mock cards repo for metadata fetch
vi.mock('@/lib/cardsRepo', () => ({
  listByDeck: async () => ([{ id: 11, question: 'Q1?' }, { id: 12, question: 'Q2?' }])
}));

// Mock fetch for answers API
const fetchMock = vi.fn();
(global as unknown as Record<string, unknown>).fetch = fetchMock;

beforeAll(() => {
  // Minimal ResizeObserver stub
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
  // summary endpoint for deck
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/api/decks/1/summary')) {
      return Promise.resolve({ ok: true, json: async () => ({ reviewedCards: 10, mastered: false }) });
    }
    if (url.includes('/api/quest/1/attempts/last-answers')) {
      return Promise.resolve({ ok: true, json: async () => ({ found: true, answers: [ { cardId: 11, correct: 1, response: 'ATP' } ] }) });
    }
    if (url.includes('/api/decks/1/mastery-awa')) {
      return Promise.resolve({ ok: true, json: async () => ({ awa: 0.5 }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
});

describe('Dashboard attempt interaction', () => {
  it.skip('opens accuracy modal then reopens without refetching answers', async () => {
  const { unmount } = render(<DashboardClient />);
    // Expand unorganized deck collapsible by clicking deck title
    const deckHeader = await screen.findByText('Bio Deck');
    fireEvent.click(deckHeader);
    // Wait for attempt button
    const attemptButton = await screen.findByRole('button', { name: /View attempt 101 accuracy details/i });
    fireEvent.click(attemptButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/quest/1/attempts/last-answers'), expect.any(Object)));
    await screen.findByText(/Mission Accuracy Details/i);
    // Close modal via close button (aria-label)
    const close = screen.getByRole('button', { name: /Close accuracy details/i });
    fireEvent.click(close);
    // Re-open
    fireEvent.click(attemptButton);
    await screen.findByText(/Mission Accuracy Details/i);
  const answersCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/quest/1/attempts/last-answers'));
  expect(answersCalls.length).toBe(1);
  // Close modal at end to prevent lingering focus trap causing jsdom unhandled errors
    const close2 = screen.getByRole('button', { name: /Close accuracy details/i });
    fireEvent.click(close2);
    // Wait for modal content to disappear (query returns null)
    await waitFor(() => {
      const stillOpen = screen.queryByText(/Mission Accuracy Details/i);
      expect(stillOpen).toBeNull();
    });
    unmount();
  }, 8000);
});
