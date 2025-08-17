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
let folderIdSeq = 1;
let deckIdSeq = 1;
const genFolderId = () => folderIdSeq++;
const genDeckId = () => deckIdSeq++;

const folders: Folder[] = [
  { id: 1, name: "General", deckIds: [], updatedAt: nowIso(), user_id: 'mock', created_at: nowIso(), color: 'text-blue-500' },
  { id: 2, name: "History", deckIds: [], updatedAt: nowIso(), user_id: 'mock', created_at: nowIso(), color: 'text-yellow-500' },
];

const decks: Deck[] = [
  {
    id: 1,
    title: "World History",
    description: "History",
    sources: ["questions_batch1_fixed.csv", "questions_batch2_fixed.csv"],
    cards: [],
    folder_id: 2,
    updatedAt: nowIso(),
    user_id: 'mock',
    created_at: nowIso(),
  },
  {
    id: 2,
    title: "Biology Basics",
    description: "Intro deck",
    sources: [],
    cards: [],
    folder_id: 1,
    updatedAt: nowIso(),
    user_id: 'mock',
    created_at: nowIso(),
  },
];

// back-fill folder deckIds based on deck.folder_id
for (const d of decks) {
  if (d.folder_id) {
    const f = folders.find((fx) => fx.id === d.folder_id);
    if (f && Array.isArray(f.deckIds) && !f.deckIds.includes(d.id)) {
      f.deckIds.push(d.id);
      f.updatedAt = nowIso();
    }
  }
}

// --- impl ---
export const mockRepo = {
  async getDeck(deckId: string): Promise<Deck | null> {
  return decks.find((d) => d.id === Number(deckId)) ?? null;
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

  async createDeck(userId: string, input: { title: string; description?: string; folder_id?: number | null }): Promise<{ id: number; title: string; description: string; folder_id: number | null }> {
    const newDeck = {
      id: genDeckId(),
      title: input.title,
      description: input.description ?? "",
      user_id: userId,
      folder_id: input.folder_id ?? null,
    };
    decks.push({ ...newDeck, sources: [], cards: [], updatedAt: nowIso() });
    if (newDeck.folder_id) {
      const f = folders.find((fx) => fx.id === newDeck.folder_id);
      if (f && Array.isArray(f.deckIds) && !f.deckIds.includes(newDeck.id)) {
        f.deckIds.push(newDeck.id);
        f.updatedAt = nowIso();
      }
    }
    return newDeck;
  },

  async listRecentDecks(): Promise<Deck[]> {
    return [...decks].sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  },

  async listFolders(): Promise<Folder[]> {
    return [...folders];
  },

  async createFolder(name: string): Promise<Folder> {
  const f: Folder = { id: genFolderId(), name, deckIds: [], updatedAt: nowIso() };
    folders.push(f);
    return f;
  },
};
