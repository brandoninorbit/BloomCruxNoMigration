// Central BloomCrux types (kept minimal so adapters can import without churn)

export type BloomLevel =
  | "Remember"
  | "Understand"
  | "Apply"
  | "Analyze"
  | "Evaluate"
  | "Create";

export type CardType =
  | "MCQ"
  | "Fill"
  | "Hotspot"
  | "Short"
  | "Sorting"
  | "Sequencing"
  | "WorkedExample"
  | "Compare"
  | "Categorize"
  | "DataInterpretation"
  | "TwoTierMCQ"
  | "CER"
  | "Design"
  | "ConceptMap"
  | "Experiment"
  | "SelfCheck";

export type Card = {
  id: string;
  prompt: string;
  answer?: string;
  bloomLevel?: BloomLevel;
  type?: CardType;
  selfCheck?: boolean;
  meta?: Record<string, unknown>;
};

export type Deck = {
  id: string;
  title: string;
  description?: string;
  sources?: string[];
  cards: Card[];
  folderId?: string | null;
  updatedAt: string; // ISO string
};

export type Folder = {
  id: string;
  name: string;
  deckIds: string[];
  updatedAt: string; // ISO string
};
