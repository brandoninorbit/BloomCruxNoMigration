'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Deck } from '@/types';
import { getDeck, updateDeck } from '@/lib/repo';

type UseDeckReturn = {
  deck: Deck | null;
  setDeck: React.Dispatch<React.SetStateAction<Deck | null>>;
  save: () => Promise<void>;
  loading: boolean;
  error: string | null;
};


export function useDeck(deckId: string): UseDeckReturn {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const d = await getDeck(deckId);
        if (!alive) return;
        if (d) {
          setDeck({
            ...d,
            title: d.title ?? '',
            description: d.description ?? '',
            sources: Array.isArray(d.sources) ? d.sources : [],
            cards: Array.isArray(d.cards) ? d.cards : [],
          });
        } else {
          setDeck(null); // show "Deck not found" UI in the page
        }
      } catch (e) {
        if (!alive) return;
        const message = e instanceof Error ? e.message : 'Failed to load deck';
        setError(message);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [deckId]);

  const save = useCallback(async () => {
    if (!deck) return;
    await updateDeck(deck);
  }, [deck]);

  return { deck, setDeck, save, loading, error };
}

export default useDeck;
