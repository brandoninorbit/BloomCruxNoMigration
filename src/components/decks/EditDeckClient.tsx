"use client";

import { useCallback, useEffect, useState } from "react";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckCard } from "@/types/deck-cards";
import CardList from "@/components/decks/CardList";

type Props = { deckId: number; title: string };

export default function EditDeckClient({ deckId }: Props) {
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const count = loaded ? cards.length : 0;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const data = await cardsRepo.listByDeck(deckId);
      setCards(data);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  const onEdit = useCallback(async (next: DeckCard) => {
    try {
      const updated = await cardsRepo.update(next);
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const onDelete = useCallback(async (id: number) => {
    try {
      await cardsRepo.remove(id);
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const onReorder = useCallback(
    async (orderedIds: number[]) => {
      try {
        await cardsRepo.reorder(deckId, orderedIds);
        setCards((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c] as const));
          const reordered = orderedIds
            .map((id, idx) => ({ ...(byId.get(id) as DeckCard), position: idx }))
            .filter(Boolean);
          return reordered;
        });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [deckId]
  );

  // Listen for newly created cards from the Add Card modal
  useEffect(() => {
    function onCreated(e: Event) {
      const detail = (e as CustomEvent).detail as { card?: DeckCard } | undefined;
      if (!detail?.card) return;
      const card = detail.card as DeckCard;
      if (!loaded || card.deckId !== deckId) return;
      setCards((prev) => {
        const exists = prev.some((c) => c.id === card.id);
        if (exists) return prev;
        const next = [...prev, card];
        next.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        return next;
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("deck-card:created", onCreated as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("deck-card:created", onCreated as EventListener);
      }
    };
  }, [loaded, deckId]);

  return (
    <section className="p-8 bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Cards in this Deck ({count})
        </h2>
        {/* no Add buttons here on purpose */}
      </div>

      {loaded && (
        <CardList
          cards={cards}
          onEdit={onEdit}
          onDelete={onDelete}
          onReorder={onReorder}
        />
      )}

      {!loaded && (
        <div className="text-center py-10">
          <button
            className="bg-[#2481f9] text-white px-6 py-3 rounded-lg font-semibold shadow-sm hover:bg-blue-600 disabled:opacity-60"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Loading…" : `Load Cards (${count})`}
          </button>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>
      )}
    </section>
  );
}
