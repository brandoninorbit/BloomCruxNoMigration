// Minimal in-memory mock repo for local dev (no auth).
// Safe for SSR: state is created per process; browser gets a hydrated copy via client calls.
import type { Deck, Folder } from "@/types";

// CardType display name to canonical value mapping
export const cardTypeDisplayToCanonical: Record<string, string> = {
  "Standard MCQ": "MCQ",
  "Two-Tier MCQ": "TwoTierMCQ",
  "Fill in the Blank": "Fill",
  "Short Answer": "Short",
  "Compare/Contrast": "Compare",
  "Drag and Drop Sorting": "Sorting",
  "Sequencing": "Sequencing",
  "Claim-Evidence-Reasoning (CER)": "CER",
};

// --- seed data ---
const nowIso = () => new Date().toISOString();
const genId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const folders: Folder[] = [
  { id: "fld_general", name: "General", deckIds: [], updatedAt: nowIso() },
  { id: "fld_history", name: "History", deckIds: [], updatedAt: nowIso() },
];

const decks: Deck[] = [
  {
    id: "dck_world_history",
    title: "World History",
    description: "History",
    sources: ["questions_batch1_fixed.csv", "questions_batch2_fixed.csv"],
    cards: [],
    folderId: "fld_history",
    updatedAt: nowIso(),
  },
  {
    id: "dck_bio_basics",
    title: "Biology Basics",
    description: "Intro deck",
    sources: [],
    cards: [],
    folderId: "fld_general",
    updatedAt: nowIso(),
  },
];

// back-fill folder deckIds based on deck.folderId
for (const d of decks) {
  if (d.folderId) {
    const f = folders.find((fx) => fx.id === d.folderId);
    if (f && !f.deckIds.includes(d.id)) {
      f.deckIds.push(d.id);
      f.updatedAt = nowIso();
    }
  }
}

// --- impl ---
export const mockRepo = {
  async getDeck(deckId: string): Promise<Deck | null> {
    return decks.find((d) => d.id === deckId) ?? null;
  },

  async updateDeck(deck: Deck): Promise<void> {
    const idx = decks.findIndex((d) => d.id === deck.id);
    if (idx >= 0) {
      decks[idx] = { ...deck, updatedAt: nowIso() };
    } else {
      // if not found, add it (useful during early dev)
      decks.push({ ...deck, updatedAt: nowIso() });
    }
  },

  async createDeck(input: { title: string; description?: string; folderId?: string | null }): Promise<Deck> {
    const newDeck: Deck = {
      id: genId("dck"),
      title: input.title,
      description: input.description ?? "",
      sources: [],
      cards: [],
      folderId: input.folderId ?? null,
      updatedAt: nowIso(),
    };
    decks.push(newDeck);
    if (newDeck.folderId) {
      const f = folders.find((fx) => fx.id === newDeck.folderId);
      if (f && !f.deckIds.includes(newDeck.id)) {
        f.deckIds.push(newDeck.id);
        f.updatedAt = nowIso();
      }
    }
    return newDeck;
  },

  async listRecentDecks(): Promise<Deck[]> {
    return [...decks].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  async listFolders(): Promise<Folder[]> {
    return [...folders];
  },

  async createFolder(name: string): Promise<Folder> {
    const f: Folder = { id: genId("fld"), name, deckIds: [], updatedAt: nowIso() };
    folders.push(f);
    return f;
  },
};
