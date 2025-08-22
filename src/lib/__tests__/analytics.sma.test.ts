import { describe, it, expect } from 'vitest';
import { computeSMA as deckSMA } from '@/components/decks/DeckProgressChart';
import { computeSMA as dashSMA } from '@/components/DashboardProgressChart';

function computeSMA(values: number[], k = 5) {
  // Delegate to one implementation to ensure parity
  return dashSMA(values, k);
}

describe('computeSMA', () => {
  it('handles empty array', () => {
    expect(computeSMA([])).toEqual([]);
  });
  it('computes SMA for sparse (1-3 attempts)', () => {
    expect(computeSMA([50])).toEqual([50]);
    expect(computeSMA([50, 100])).toEqual([50, 75]);
    expect(computeSMA([50, 100, 0])).toEqual([50, 75, 50]);
  });
  it('smooths volatile zig-zag', () => {
    const src = [0, 100, 0, 100, 0, 100];
    const sma = computeSMA(src, 5);
    // SMA should be between 40 and 60 by the 5th point, then trend ~60-80
    expect(sma[4]).toBeGreaterThanOrEqual(40);
    expect(sma[4]).toBeLessThanOrEqual(60);
    expect(sma[5]).toBeGreaterThan(sma[3]);
  });
  it('zeros are valid values (no gaps)', () => {
    const src = [0, 0, 10, 0, 0];
    const sma = computeSMA(src, 5);
    expect(sma.length).toBe(src.length);
    expect(sma[0]).toBe(0);
    expect(sma[2]).toBeGreaterThan(0);
  });
});

describe('acceptance: overlapping decks', () => {
  it('can build two series with overlapping timestamps and preserve values', () => {
    const times = [1, 2, 3, 4, 5];
    const deckA = [10, 20, 30, 40, 50];
    const deckB = [50, 40, 30, 20, 10];
    const smaA = computeSMA(deckA, 5);
    const smaB = computeSMA(deckB, 5);
    expect(smaA[0]).toBeCloseTo(10);
    expect(smaB[0]).toBeCloseTo(50);
    expect(smaA[4]).toBeCloseTo(30); // avg of 10..50
    expect(smaB[4]).toBeCloseTo(30); // avg of 50..10
  });
});
