export type DeckBloomLevel =
  | 'Remember'
  | 'Understand'
  | 'Apply'
  | 'Analyze'
  | 'Evaluate'
  | 'Create';

export type DeckCardType = 'Standard MCQ' | 'Short Answer';

export type DeckMCQMeta = {
  options: { A: string; B: string; C: string; D: string };
  answer: 'A' | 'B' | 'C' | 'D';
};

export type DeckShortMeta = { suggestedAnswer: string };

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

export type DeckCard = DeckStandardMCQ | DeckShortAnswer;
