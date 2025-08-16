// Dynamic facade around the current data repo (mock for now).
// Hides async/dynamic import behind simple functions so the rest of the app stays sync-ish.
import type { Deck, Folder } from "@/types";

interface DecksRepo {
  getDeck(deckId: string): Promise<Deck | null>;
  updateDeck(deck: Deck): Promise<void>;
  createDeck(input: { title: string; description?: string; folderId?: string | null }): Promise<Deck>;
  listRecentDecks(): Promise<Deck[]>;
  listFolders(): Promise<Folder[]>;
  createFolder(name: string): Promise<Folder>;
}

let repoPromise: Promise<DecksRepo> | null = null;

async function getRepo(): Promise<DecksRepo> {
  if (!repoPromise) {
    repoPromise = import("./mockRepo").then((m) => m.mockRepo);
  }
  return repoPromise;
}

export async function getDeck(id: string): Promise<Deck | null> {
  return (await getRepo()).getDeck(id);
}

export async function updateDeck(deck: Deck): Promise<void> {
  return (await getRepo()).updateDeck(deck);
}

export async function createDeck(input: { title: string; description?: string; folderId?: string | null }): Promise<Deck> {
  return (await getRepo()).createDeck(input);
}

export async function listRecentDecks(): Promise<Deck[]> {
  return (await getRepo()).listRecentDecks();
}

export async function listFolders(): Promise<Folder[]> {
  return (await getRepo()).listFolders();
}

export async function createFolder(name: string): Promise<Folder> {
  return (await getRepo()).createFolder(name);
}
