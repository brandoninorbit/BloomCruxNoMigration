/* eslint-disable @typescript-eslint/no-unused-vars */
// Draft Supabase adapter — not wired yet. The app uses a mock repo for now.
// Remove this disable and fill real calls when integrating Supabase.

import type { Deck, Folder } from "@/types";

export class DecksRepoSupabase {
  async getDeck(_userId: string, _deckId: string): Promise<Deck | null> {
    return null;
  }

  async updateDeck(_userId: string, _deck: Deck): Promise<void> {}

  async createDeck(
    _userId: string,
    _input: { title: string; description?: string; folderId?: string | null }
  ): Promise<Deck> {
    throw new Error("Not implemented");
  }

  async listRecentDecks(_userId: string): Promise<Deck[]> {
    return [];
  }

  async listFolders(_userId: string): Promise<Folder[]> {
    return [];
  }

  async createFolder(_userId: string, _name: string): Promise<Folder> {
    throw new Error("Not implemented");
  }
}

// Marker export so the module is a valid import target even before wiring.
export const SUPABASE_ADAPTER_DRAFT = true;

