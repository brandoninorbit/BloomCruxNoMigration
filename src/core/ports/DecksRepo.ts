// src/core/ports/DecksRepo.ts
import type { Deck } from "@/core/types";

export interface DecksRepo {
  list(): Promise<Deck[]>;
  get(id: string): Promise<Deck | null>;
  create(data: Omit<Deck, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  update(id: string, patch: Partial<Deck>): Promise<void>;
  remove(id: string): Promise<void>;
}