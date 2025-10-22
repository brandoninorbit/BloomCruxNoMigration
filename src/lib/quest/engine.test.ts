import { describe, it, expect } from 'vitest';
import type { DeckCard, DeckBloomLevel } from '@/types/deck-cards';
import { composeMission } from './engine';

function makeCard(id: number, bloomLevel: DeckBloomLevel): DeckCard {
  return {
    id,
    deckId: 1,
    type: 'mcq',
    question: `Q${id}`,
    options: ['A','B','C','D'],
    answer: 'A',
    bloomLevel,
  } as unknown as DeckCard;
}

describe('composeMission cap', () => {
  it('caps Remember missions at DEFAULT missionCap (no blasts/review)', () => {
    const all = Array.from({ length: 60 }).map((_, i) => makeCard(i + 1, 'Remember'));
    const comp = composeMission({ deckId: 1, level: 'Remember', allCards: all, missionIndex: 0 });
    expect(comp.missionIds.length).toBeLessThanOrEqual(25);
    expect(comp.missionIds.length).toBeGreaterThan(0);
  });

  it('never exceeds cap even with blasts/review pools', () => {
    const primary = Array.from({ length: 40 }).map((_, i) => makeCard(i + 1, 'Evaluate'));
    const lowerAnalyze = Array.from({ length: 40 }).map((_, i) => makeCard(100 + i + 1, 'Analyze'));
    const lowerUnderstand = Array.from({ length: 40 }).map((_, i) => makeCard(200 + i + 1, 'Understand'));
    const all = [...primary, ...lowerAnalyze, ...lowerUnderstand];
    const comp = composeMission({ deckId: 2, level: 'Evaluate', allCards: all, missionIndex: 0 });
    expect(comp.missionIds.length).toBeLessThanOrEqual(25);
  });
});
