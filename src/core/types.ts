// src/core/types.ts
export type DeckId = string;
export type CardId = string;

export interface Deck {
  id: DeckId;
  name: string;
  description?: string;
  createdAt: number;   // epoch millis
  updatedAt: number;   // epoch millis
  ownerId?: string;
}

export interface Card {
  id: CardId;
  deckId: DeckId;
  front: string;
  back: string;
  starred?: boolean;
  createdAt: number;   // epoch millis
  updatedAt: number;   // epoch millis
}
