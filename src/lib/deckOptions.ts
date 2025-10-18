"use client";

export type DeckOptions = {
  markupEnabled: boolean; // enables subscripts/superscripts/greek formatting
};

const DEFAULTS: DeckOptions = {
  markupEnabled: true,
};

function key(deckId: number | string) {
  return `deck:opts:${deckId}`;
}

export function loadDeckOptions(deckId: number | string): DeckOptions {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(key(deckId));
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DeckOptions>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function saveDeckOptions(deckId: number | string, partial: Partial<DeckOptions>): DeckOptions {
  if (typeof window === "undefined") return { ...DEFAULTS, ...partial } as DeckOptions;
  const current = loadDeckOptions(deckId);
  const next = { ...current, ...partial };
  try { localStorage.setItem(key(deckId), JSON.stringify(next)); } catch {}
  return next;
}
