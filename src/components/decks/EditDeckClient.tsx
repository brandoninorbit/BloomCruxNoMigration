"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckCard } from "@/types/deck-cards";
import CardList from "@/components/decks/CardList";

type Props = { deckId: number; title: string };

export default function EditDeckClient({ deckId }: Props) {
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<"Default" | "Bloom Level" | "Card Format">("Default");

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

  // manual reordering controls removed per spec; keeping sorting dropdown only

  const displayedCards = useMemo(() => {
    if (sortBy === "Default") return cards;

    const arr = [...cards];
    if (sortBy === "Bloom Level") {
      const order = new Map([
        ["Remember", 0],
        ["Understand", 1],
        ["Apply", 2],
        ["Analyze", 3],
        ["Evaluate", 4],
        ["Create", 5],
      ]);
      arr.sort((a, b) => {
        const ai = a.bloomLevel ? order.get(a.bloomLevel) ?? 999 : 999;
        const bi = b.bloomLevel ? order.get(b.bloomLevel) ?? 999 : 999;
        if (ai !== bi) return ai - bi;
        // stable within group by original position/id
        return (a.position ?? 0) - (b.position ?? 0) || a.id - b.id;
      });
    } else if (sortBy === "Card Format") {
      arr.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return (a.position ?? 0) - (b.position ?? 0) || a.id - b.id;
      });
    }
    return arr;
  }, [cards, sortBy]);

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
    function onReload() {
      // Best-effort reload of cards (e.g., after delete-by-source)
      void load();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("deck-card:created", onCreated as EventListener);
      window.addEventListener("deck-cards:reload", onReload as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("deck-card:created", onCreated as EventListener);
        window.removeEventListener("deck-cards:reload", onReload as EventListener);
      }
    };
  }, [loaded, deckId, load]);

  return (
    <section className="p-8 bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Cards in this Deck ({count})
        </h2>
        {loaded && (
          <div className="flex items-center gap-2">
            <label htmlFor="sort-cards" className="text-sm text-gray-600">
              Sort by
            </label>
            <select
              id="sort-cards"
              className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:border-[#2481f9] focus:outline-none focus:ring-2 focus:ring-[#2481f9] focus:border-[#2481f9] shadow-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option>Default</option>
              <option>Bloom Level</option>
              <option>Card Format</option>
            </select>
          </div>
        )}
      </div>

      {loaded && (
        <CardList
          cards={displayedCards}
          onEdit={onEdit}
          onDelete={onDelete}
          onContinue={() => {
            // In edit context, just no-op; the modal will close itself when not provided.
            // This is here to keep onContinue threaded globally.
          }}
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
