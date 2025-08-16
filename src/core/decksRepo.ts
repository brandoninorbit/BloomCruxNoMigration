// src/core/decksRepo.ts

export interface Deck {
  id: number;
  folderId: number;
  tag: string;
  title: string;
  locked: boolean;
  mastery: number;
  bloomLevel: string;
}

export interface Folder {
  id: number;
  name: string;
  sets: number;
  color: string;
  iconBg: string;
}

export interface DecksRepo {
  getDecks(): Promise<Deck[]>;
  getFolders(): Promise<Folder[]>;
  createDeck(deck: Omit<Deck, 'id'>): Promise<Deck>;
  createFolder(folder: Omit<Folder, 'id' | 'sets'>): Promise<Folder>;
  // Add more methods as needed
}

import { DecksRepoMemory } from "@/core/adapters/memory/DecksRepoMemory";
// import { DecksRepoSupabase } from "@/core/adapters/supabase/DecksRepoSupabase"; // TODO: Enable when Supabase adapter is implemented

let cached: DecksRepo | undefined = undefined;

export function getDecksRepo(): DecksRepo {
  if (cached) return cached;
  if (process.env.NEXT_PUBLIC_USE_MEM === "1") {
    cached = new DecksRepoMemory();
  } else {
    // TODO: Enable Supabase adapter when implemented
    cached = new DecksRepoMemory();
  }
  // TODO: Complete implementation when repo logic is ready
  return cached!;
}