import { describe, it, expect } from 'vitest';
import { rowToPayload, type CsvRow } from './csvImport';
import type { DeckMCQMeta, DeckFillMetaV3, DeckSortingMeta, DeckTwoTierMCQMeta, DeckSequencingMeta, DeckCompareContrastMeta, DeckCERMeta } from '@/types/deck-cards';

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

  it('two-tier labeled RA..RD and RAnswer alias Tier2Answer', () => {
    const row: CsvRow = {
      CardType: 'Two-Tier MCQ',
      Question: 'Q1',
      A: 'A) a1', B: 'B) b1', C: 'C) c1', D: 'D) d1', Answer: 'A',
      RQuestion: 'Why?',
      RA: 'A) r1', RB: 'B) r2', RC: 'C) r3', RD: 'D) r4',
      Tier2Answer: 'D'
    };
  const p = rowToPayload(row);
  const m: DeckTwoTierMCQMeta = p.meta as DeckTwoTierMCQMeta;
    expect(m.tier2.options.D).toBe('r4');
    expect(m.tier2.answer).toBe('D');
  });

  it('Fill multi-blank defaults mode based on Options; seeds options when DnD and missing', () => {
    // Case 1: Options present -> Drag & Drop default
    const r1: CsvRow = {
      CardType: 'Fill in the Blank',
      Question: '[[1]] then [[2]]',
      Answer1: 'first', Answer2: 'second',
      Options: 'first|second|third'
    };
    const p1 = rowToPayload(r1);
    const m1 = p1.meta as DeckFillMetaV3;
    expect(m1.mode).toBe('Drag & Drop');
    expect(m1.options?.includes('first')).toBe(true);
    // Case 2: DnD chosen but options missing -> seed from answers
    const r2: CsvRow = {
      CardType: 'Fill in the Blank',
      Question: '[[1]] [[2]]',
      Answer1: 'alpha', Answer2: 'beta',
      Mode: 'Drag & Drop'
    };
    const p2 = rowToPayload(r2);
    const m2 = p2.meta as DeckFillMetaV3;
    expect(new Set(m2.options)).toContain('alpha');
    expect(new Set(m2.options)).toContain('beta');
  });

  it('Short Answer Suggested alias', () => {
    const row: CsvRow = { CardType: 'Short Answer', Prompt: 'SA', Suggested: 'text' };
  const p = rowToPayload(row);
  const m = p.meta as { suggestedAnswer: string };
  expect(m.suggestedAnswer).toBe('text');
  });

  it('Sequencing from Steps list', () => {
    const row: CsvRow = { CardType: 'Sequencing', Question: 'Order', Steps: 'First|Second|Third' };
    const p = rowToPayload(row);
    const m = p.meta as DeckSequencingMeta;
    expect(m.steps).toEqual(['First','Second','Third']);
  });

  it('Compare/Contrast point parsing', () => {
    const row: CsvRow = {
      CardType: 'Compare/Contrast',
      ItemA: 'Backbone', ItemB: 'Folding',
      Points: 'Backbone::Seq::Local folding|Bonds::Peptide::H-bonds'
    };
    const p = rowToPayload(row);
    const m = p.meta as DeckCompareContrastMeta;
    expect(m.points[0].feature).toBe('Backbone');
    expect(m.points[1].b).toBe('H-bonds');
  });

  it('CER Free Text and Multiple Choice', () => {
    const free: CsvRow = {
      CardType: 'CER',
      Scenario: 'S',
      Guidance: 'G',
      Claim: 'C1', Evidence: 'E1', Reasoning: 'R1'
    };
  const pf = rowToPayload(free);
  const mf = pf.meta as DeckCERMeta;
  expect((mf.claim as { sampleAnswer?: string }).sampleAnswer).toBe('C1');
    const mc: CsvRow = {
      CardType: 'CER', Scenario: 'S', Mode: 'MC',
      ClaimOptions: 'A|B', ClaimCorrect: '2',
      EvidenceOptions: 'E|F', EvidenceCorrect: '1',
      ReasoningOptions: 'R|S', ReasoningCorrect: '2'
    };
  const pm = rowToPayload(mc);
  const mm = pm.meta as DeckCERMeta;
  expect((mm.claim as { options: string[]; correct: number }).correct).toBe(1);
  expect((mm.reasoning as { options: string[]; correct: number }).correct).toBe(1);
  });

  it('Bloom override + Analyse spelling; Explanation separate', () => {
    const row: CsvRow = {
      CardType: 'Standard MCQ',
      Question: 'Bloom test',
      A: 'A', B: 'B', C: 'C', D: 'D', Answer: 'A',
      BloomLevel: 'Analyse',
      Explanation: 'why'
    };
    const p = rowToPayload(row);
    expect(p.bloomLevel).toBe('Analyze');
    expect(p.explanation).toBe('why');
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
