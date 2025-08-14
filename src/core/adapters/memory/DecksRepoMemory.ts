
// src/core/adapters/memory/DecksRepoMemory.ts
'use client';
import type { Deck } from '@/core/types';
import type { DecksRepo } from '@/core/ports/DecksRepo';

export class DecksRepoMemory implements DecksRepo {
  private decks = new Map<string, Deck>();

  constructor(seed?: Deck[]) {
    seed?.forEach((d) => this.decks.set(d.id, d));
  }

  async list(): Promise<Deck[]> {
    return Array.from(this.decks.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<Deck | null> {
    return this.decks.get(id) ?? null;
  }

  async create(
    data: Omit<Deck, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    this.decks.set(id, { id, createdAt: now, updatedAt: now, ...data });
    return id;
  }

  async update(id: string, patch: Partial<Deck>): Promise<void> {
    const existing = this.decks.get(id);
    if (!existing) return;
    this.decks.set(id, { ...existing, ...patch, updatedAt: Date.now() });
  }

  async remove(id: string): Promise<void> {
    this.decks.delete(id);
  }
}
