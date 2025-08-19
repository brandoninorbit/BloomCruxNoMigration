import { describe, it, expect } from 'vitest';
import { rowToPayload, type CsvRow } from './csvImport';
import type { DeckMCQMeta, DeckFillMetaV3, DeckSortingMeta, DeckTwoTierMCQMeta } from '@/types/deck-cards';

describe('csvImport.rowToPayload', () => {
  it('parses MCQ with labeled/misaligned options and correct answer', () => {
    const row: CsvRow = {
      CardType: 'Standard MCQ',
      Question: 'Which functional group is common to all amino acids?',
      A: 'A) Hydroxyl group',
      B: 'B) Carboxyl group',
      C: 'C) Sulfhydryl group',
      D: 'D) Methyl group',
      Answer: 'B',
    };
  const payload = rowToPayload(row);
  expect(payload.type).toBe('Standard MCQ');
  const meta = payload.meta as DeckMCQMeta;
    expect(meta.options.A).toContain('Hydroxyl');
    expect(meta.options.B).toContain('Carboxyl');
    expect(meta.answer).toBe('B');
  });

  it('parses Fill in the Blank V3 with word bank inference', () => {
    const row: CsvRow = {
      CardType: 'Fill in the Blank',
      Question: 'Proteins are made of repeating [[1]] units linked by [[2]] bonds.',
      Answer1: 'amino acid',
      Answer2: 'peptide',
      Options: 'amino acid|nucleotide|peptide|hydrogen',
      Mode: 'Drag & Drop',
    };
  const payload = rowToPayload(row);
  expect(payload.type).toBe('Fill in the Blank');
  const meta = payload.meta as DeckFillMetaV3;
    expect(meta.mode).toMatch(/Drag/);
    expect(meta.blanks.length).toBe(2);
    expect(meta.blanks[0].answers[0]).toBe('amino acid');
    expect(new Set(meta.options)).toContain('peptide');
  });

  it('parses Sorting categories and items, inferring categories when needed', () => {
    const row: CsvRow = {
      CardType: 'Sorting',
      Question: 'Sort these molecules by type.',
      Categories: 'Polymers|Monomers',
      Items: 'Amino acids:Monomers|Proteins:Polymers',
    };
  const payload = rowToPayload(row);
  expect(payload.type).toBe('Sorting');
  const meta = payload.meta as DeckSortingMeta;
    expect(meta.categories).toEqual(['Polymers','Monomers']);
    expect(meta.items.length).toBe(2);
  });

  it('Two-Tier MCQ parses tier1 and tier2 independently without leakage', () => {
    const row: CsvRow = {
      CardType: 'Two-Tier MCQ',
      Question: 'What is X?',
      A: 'Alpha',
      B: 'Beta',
      C: 'Gamma',
      D: 'Delta',
      Answer: 'B',
      RQuestion: 'Why is that correct?',
      RA: 'Reason A',
      RB: 'Reason B',
      RC: 'Reason C',
      RD: 'Reason D',
      RAnswer: 'C',
    };
    const payload = rowToPayload(row);
    expect(payload.type).toBe('Two-Tier MCQ');
    const meta = payload.meta as DeckTwoTierMCQMeta;
    expect(meta.tier1.options.A).toBe('Alpha');
    expect(meta.tier1.answer).toBe('B');
    expect(meta.tier2.question).toContain('Why');
    expect(meta.tier2.options.C).toBe('Reason C');
    expect(meta.tier2.answer).toBe('C');
  });

  it('BloomLevel synonyms (e.g., L4) normalize to proper Bloom level', () => {
    const row: CsvRow = {
      CardType: 'Standard MCQ',
      Question: 'Bloom synonym test',
  A: 'Option A',
  B: 'Option B',
  C: 'Option C',
  D: 'Option D',
      Answer: 'A',
      BloomLevel: 'L4',
    };
    const payload = rowToPayload(row);
    expect(payload.bloomLevel).toBe('Analyze');
  });
});
