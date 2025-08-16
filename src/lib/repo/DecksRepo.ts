import type { Deck, Folder } from '@/types';

export interface DecksRepo {
  getDeck(deckId: string): Promise<Deck | null>;
  updateDeck(deck: Deck): Promise<void>;
  createDeck(input: { title: string; description?: string; folderId?: string | null; }): Promise<Deck>;
  listRecentDecks(): Promise<Deck[]>;
  listFolders(): Promise<Folder[]>;
  createFolder(name: string): Promise<Folder>;
}
