import { describe, it, expect } from 'vitest';
import { mergeCardStats } from './mergeCardStats';

describe('mergeCardStats edge cases (phase 1)', () => {
  it('edge 1: returns empty array for empty inputs', () => {
    const merged = mergeCardStats([], []);
    expect(merged).toEqual([]);
  });

  it('edge 2: statsRows empty, answerRows non-empty builds synthetic base rows', () => {
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 1000).toISOString();
    const answers = [
      { card_id: 5, correct_fraction: 1, answered_at: now },
      { card_id: 7, correct_fraction: 0.5, answered_at: earlier },
    ];
    const merged = mergeCardStats([], answers);
    expect(merged.length).toBe(2);
    const byId = Object.fromEntries(merged.map(r => [r.cardId, r]));
    expect(byId[5]).toMatchObject({ attempts: 0, correct: 0, streak: 0, ease: 2.5 });
    expect(byId[5].bestCorrectness).toBe(1);
    expect(byId[5].avgCorrectness).toBe(1);
    expect(byId[5].lastAnsweredAt).toBe(now);
    expect(byId[7].bestCorrectness).toBeCloseTo(0.5, 5);
    expect(byId[7].avgCorrectness).toBeCloseTo(0.5, 5);
  });

  it('edge 3: statsRows non-empty, answerRows empty preserves base metrics with zeroed correctness fields', () => {
    const due = new Date(Date.now() + 86400000).toISOString();
    const stats = [
      { card_id: 10, attempts: 4, correct: 3, streak: 2, ease: 2.4, interval_days: 6, due_at: due },
      { card_id: 11, attempts: 1, correct: 0, streak: 0, ease: 2.5, interval_days: 1, due_at: null },
    ];
    const merged = mergeCardStats(stats, []);
    // Order by cardId ascending guaranteed
    expect(merged.map(r => r.cardId)).toEqual([10, 11]);
    const m10 = merged[0];
    expect(m10.attempts).toBe(4);
    expect(m10.bestCorrectness).toBe(0);
    expect(m10.avgCorrectness).toBe(0);
    expect(m10.lastAnsweredAt).toBeNull();
  });
});

describe('mergeCardStats edge cases (phase 2)', () => {
  it('edge 4: duplicate answers aggregate best=max and avg over all', () => {
    const t1 = new Date(Date.now() - 5000).toISOString();
    const t2 = new Date(Date.now() - 3000).toISOString();
    const t3 = new Date().toISOString();
    const answers = [
      { card_id: 20, correct_fraction: 0.25, answered_at: t1 },
      { card_id: 20, correct_fraction: 0.75, answered_at: t2 },
      { card_id: 20, correct_fraction: 0.5, answered_at: t3 },
    ];
    const merged = mergeCardStats([], answers);
    expect(merged.length).toBe(1);
    const row = merged[0];
    expect(row.bestCorrectness).toBe(0.75);
    expect(row.avgCorrectness).toBeCloseTo((0.25 + 0.75 + 0.5) / 3, 5);
    expect(row.lastAnsweredAt).toBe(t3); // latest timestamp
  });

  it('edge 5: null correct_fraction treated as 0 and does not break aggregation', () => {
    const t1 = new Date().toISOString();
    const answers = [
      { card_id: 21, correct_fraction: null, answered_at: t1 },
      { card_id: 21, correct_fraction: 1, answered_at: t1 },
    ];
    const merged = mergeCardStats([], answers);
    const row = merged[0];
    // best should be 1, avg counts both entries (null becomes 0 per implementation semantics)
    expect(row.bestCorrectness).toBe(1);
    expect(row.avgCorrectness).toBeCloseTo(0.5, 5);
  });

  it('edge 6: mixed presence (stats only, answers only, both) merged correctly', () => {
    const stats = [
      { card_id: 30, attempts: 2, correct: 1, streak: 1, ease: 2.5, interval_days: 3, due_at: null }, // stats only
      { card_id: 31, attempts: 5, correct: 4, streak: 3, ease: 2.6, interval_days: 5, due_at: null }, // both
    ];
    const now = new Date().toISOString();
    const answers = [
      { card_id: 31, correct_fraction: 0.8, answered_at: now }, // enrich existing
      { card_id: 32, correct_fraction: 0.4, answered_at: now }, // answers only
    ];
    const merged = mergeCardStats(stats, answers);
    // Expect cardIds 30,31,32 sorted
    expect(merged.map(r => r.cardId)).toEqual([30, 31, 32]);
    const byId = Object.fromEntries(merged.map(r => [r.cardId, r]));
    // 30: untouched correctness
    expect(byId[30].avgCorrectness).toBe(0);
    // 31: baseline preserved + correctness updated
    expect(byId[31].attempts).toBe(5);
    expect(byId[31].bestCorrectness).toBeCloseTo(0.8, 5);
    // 32: synthetic base values
    expect(byId[32].attempts).toBe(0);
    expect(byId[32].bestCorrectness).toBeCloseTo(0.4, 5);
  });
});
