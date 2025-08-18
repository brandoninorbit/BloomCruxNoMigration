// Specialized card type definitions (non-breaking alongside existing types)
// These types model MCQ and Short Answer cards with Bloom levels.

export type BloomLevel =
  | 'Remember'
  | 'Understand'
  | 'Apply'
  | 'Analyze'
  | 'Evaluate'
  | 'Create';

export type CardType = 'Standard MCQ' | 'Short Answer';

export type BaseCard = {
  id: number;            // matches bigint in SQL, but JS number is fine for now
  deckId: number;
  type: CardType;
  bloomLevel?: BloomLevel;
  question: string;
  explanation?: string;
  position?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type StandardMCQ = BaseCard & {
  type: 'Standard MCQ';
  A: string; B: string; C: string; D: string;
  answer: 'A' | 'B' | 'C' | 'D';
};

export type ShortAnswer = BaseCard & {
  type: 'Short Answer';
  suggestedAnswer: string;
};

export type Card = StandardMCQ | ShortAnswer;
