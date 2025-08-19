export type DeckBloomLevel =
  | 'Remember'
  | 'Understand'
  | 'Apply'
  | 'Analyze'
  | 'Evaluate'
  | 'Create';

export type DeckCardType = 'Standard MCQ' | 'Short Answer' | 'Fill in the Blank' | 'Sorting' | 'Sequencing' | 'Compare/Contrast' | 'Two-Tier MCQ' | 'CER';

export type DeckMCQMeta = {
  options: { A: string; B: string; C: string; D: string };
  answer: 'A' | 'B' | 'C' | 'D';
};

export type DeckShortMeta = { suggestedAnswer: string };
export type DeckFillMode = 'Free Text' | 'Drag & Drop' | 'Either';
// Backward-compatible: V1 used a single answer string. V2 supports multiple blanks and optional options for DnD.
export type DeckFillMetaV1 = { answer: string };
export type DeckFillMetaV2 = { mode: Exclude<DeckFillMode, 'Either'>; answers: string[]; options?: string[] };
// V3: structured blank specs with per-blank flags and optional global flags/options
export type DeckFillBlankSpec = {
  id: string | number;
  answers: string[]; // include alternates; first is primary
  hint?: string;
  mode?: DeckFillMode; // overrides card-level mode
  caseSensitive?: boolean; // overrides card-level flag
  ignorePunct?: boolean;   // overrides card-level flag
};
export type DeckFillMetaV3 = {
  mode: DeckFillMode; // default behavior for blanks
  blanks: DeckFillBlankSpec[];
  options?: string[]; // word bank when Drag & Drop or Either
  caseSensitive?: boolean; // default grading flags
  ignorePunct?: boolean;
};
export type DeckFillMeta = DeckFillMetaV1 | DeckFillMetaV2 | DeckFillMetaV3;
export type DeckSortingItem = { term: string; correctCategory: string };
export type DeckSortingMeta = { categories: string[]; items: DeckSortingItem[] };
export type DeckSequencingMeta = { steps: string[] };
export type DeckCompareContrastPoint = { feature: string; a: string; b: string };
export type DeckCompareContrastMeta = { itemA: string; itemB: string; points: DeckCompareContrastPoint[] };
export type DeckTwoTierMCQMeta = {
  tier1: { options: { A: string; B: string; C: string; D: string }; answer: 'A' | 'B' | 'C' | 'D' };
  tier2: { question: string; options: { A: string; B: string; C: string; D: string }; answer: 'A' | 'B' | 'C' | 'D' };
};

export type DeckCERMode = 'Free Text' | 'Multiple Choice';
export type DeckCERPart =
  | { sampleAnswer?: string }
  | { options: string[]; correct: number };
export type DeckCERMeta = {
  mode: DeckCERMode;
  guidanceQuestion?: string; // Guide how to answer the scenario/prompt (card.question)
  claim: DeckCERPart;
  evidence: DeckCERPart;
  reasoning: DeckCERPart;
};

export type DeckBaseCard = {
  id: number;        // bigint in SQL; number in TS is fine
  deckId: number;
  type: DeckCardType;
  bloomLevel?: DeckBloomLevel;
  question: string;
  explanation?: string;
  meta: unknown;        // concrete in subtypes
  position?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type DeckStandardMCQ = Omit<DeckBaseCard, 'type' | 'meta'> & {
  type: 'Standard MCQ';
  meta: DeckMCQMeta;
};

export type DeckShortAnswer = Omit<DeckBaseCard, 'type' | 'meta'> & {
  type: 'Short Answer';
  meta: DeckShortMeta;
};

export type DeckFillBlank = Omit<DeckBaseCard, 'type' | 'meta'> & {
  type: 'Fill in the Blank';
  meta: DeckFillMeta;
};

export type DeckSorting = Omit<DeckBaseCard, 'type' | 'meta'> & {
  type: 'Sorting';
  meta: DeckSortingMeta;
};

export type DeckSequencing = Omit<DeckBaseCard, 'type' | 'meta'> & {
  type: 'Sequencing';
  meta: DeckSequencingMeta;
};

export type DeckCompareContrast = Omit<DeckBaseCard, 'type' | 'meta'> & {
  type: 'Compare/Contrast';
  meta: DeckCompareContrastMeta;
};

export type DeckTwoTierMCQ = Omit<DeckBaseCard, 'type' | 'meta'> & {
  type: 'Two-Tier MCQ';
  meta: DeckTwoTierMCQMeta;
};

export type DeckCER = Omit<DeckBaseCard, 'type' | 'meta'> & {
  type: 'CER';
  meta: DeckCERMeta;
};

export type DeckCard =
  | DeckStandardMCQ
  | DeckShortAnswer
  | DeckFillBlank
  | DeckSorting
  | DeckSequencing
  | DeckCompareContrast
  | DeckTwoTierMCQ
  | DeckCER;
