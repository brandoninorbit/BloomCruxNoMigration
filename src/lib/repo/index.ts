// Dynamic facade around the current data repo (mock for now).
// Hides async/dynamic import behind simple functions so the rest of the app stays sync-ish.
import type { Deck, Folder } from "@/types";
import { supabaseRepo } from "./supabaseRepo";

interface DecksRepo {
  getDeck(deckId: string): Promise<Deck | null>;
  updateDeck(deck: Deck): Promise<void>;
  createDeck(userId: string, input: { title: string; description?: string; folder_id?: number | null }): Promise<{ id: number; title: string; description: string; folder_id: number | null }>;
  listRecentDecks(): Promise<Deck[]>;
  listFolders(): Promise<Folder[]>;
  createFolder(name: string): Promise<Folder>;
}

async function getRepo(): Promise<DecksRepo> {
  return supabaseRepo;
}

export async function getDeck(id: string): Promise<Deck | null> {
  return (await getRepo()).getDeck(id);
}

export async function updateDeck(deck: Deck): Promise<void> {
  return (await getRepo()).updateDeck(deck);
}

export async function createDeck(_input: { title: string; description?: string; folderId?: string | null }): Promise<Deck> {
  // Deprecated: use createDeckWithUser instead
  throw new Error("Use createDeckWithUser(userId, input) instead");

}

export async function createDeckWithUser(userId: string, input: { title: string; description?: string; folder_id?: number | null }): Promise<{ id: number; title: string; description: string; folder_id: number | null }> {
  return (await getRepo()).createDeck(userId, input);
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
