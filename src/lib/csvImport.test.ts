import { describe, it, expect } from 'vitest';
import { rowToPayload, type CsvRow } from './csvImport';
import type { DeckMCQMeta, DeckFillMetaV3, DeckSortingMeta } from '@/types/deck-cards';

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
});
