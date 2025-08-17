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

export type Folder = {
  id: number;
  name: string;
  deckIds?: number[];
  color?: string | null;
  user_id?: string;
  created_at?: string;
  updatedAt?: string;
};

export type FolderWithCount = Folder & {
  deck_count: number;
};

export type Deck = {
  id: number;
  title: string;
  description?: string;
  sources?: string[];
  cards?: Card[];
  user_id?: string;
  folder_id?: number | null;
  created_at?: string;
  updatedAt?: string;
};
