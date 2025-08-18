import { getSupabaseClient } from "@/lib/supabase/browserClient";
import type {
  DeckCard,
  DeckCardType,
  DeckBloomLevel,
  DeckStandardMCQ,
  DeckShortAnswer,
  DeckMCQMeta,
  DeckShortMeta,
} from "@/types/deck-cards";

// Database row shape for 'cards' table
type CardRow = {
  id: number;
  deck_id: number;
  type: DeckCardType;
  bloom_level: DeckBloomLevel | null;
  question: string;
  explanation: string | null;
  meta: unknown; // stored as JSONB in DB
  position: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function rowToCard(row: CardRow): DeckCard {
  const base = {
    id: Number(row.id),
    deckId: Number(row.deck_id),
    type: row.type,
    bloomLevel: row.bloom_level ?? undefined,
    question: row.question ?? "",
    explanation: row.explanation ?? undefined,
    meta: row.meta,
    position: row.position ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  } as const;

  if (row.type === "Standard MCQ") {
    return {
      ...base,
      type: "Standard MCQ",
      meta: row.meta as DeckMCQMeta,
    } satisfies DeckStandardMCQ;
  }
  return {
    ...base,
    type: "Short Answer",
    meta: row.meta as DeckShortMeta,
  } satisfies DeckShortAnswer;
}

function cardToRow(card: DeckCard): Omit<CardRow, "id" | "created_at" | "updated_at"> {
  return {
    deck_id: card.deckId,
    type: card.type,
    bloom_level: card.bloomLevel ?? null,
    question: card.question,
    explanation: card.explanation ?? null,
    meta: card.meta,
    position: card.position ?? null,
  };
}

function readableError(prefix: string, err: unknown) {
  let message: string;
  if (typeof err === "object" && err !== null && "message" in err) {
    message = (err as { message?: string }).message ?? String(err);
  } else {
    message = String(err);
  }
  return new Error(`${prefix}: ${message}`);
}

export type NewDeckCard = {
  deckId: number;
  type: DeckCardType;
  bloomLevel?: DeckBloomLevel;
  question: string;
  explanation?: string;
  meta: DeckMCQMeta | DeckShortMeta;
  position?: number;
};

export async function listByDeck(deckId: number): Promise<DeckCard[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", deckId)
    .order("position", { ascending: true });

  if (error) throw readableError("Failed to list cards", error);
  const rows = (data ?? []) as CardRow[];
  return rows.map(rowToCard);
}

export async function create(input: NewDeckCard): Promise<DeckCard> {
  const supabase = getSupabaseClient();
  const row = cardToRow({
    id: 0 as unknown as number,
    deckId: input.deckId,
    type: input.type,
    bloomLevel: input.bloomLevel,
    question: input.question,
    explanation: input.explanation,
    meta: input.meta,
    position: input.position,
  } as DeckCard);
  const { data, error } = await supabase
    .from("cards")
    .insert([row])
    .select("*")
    .single();

  if (error) throw readableError("Failed to create card", error);
  return rowToCard(data as CardRow);
}

export async function update(card: DeckCard): Promise<DeckCard> {
  const supabase = getSupabaseClient();
  if (!card.id) throw new Error("update requires card.id");

  const row = cardToRow(card);
  const { data, error } = await supabase
    .from("cards")
    .update(row)
    .eq("id", card.id)
    .select("*")
    .single();

  if (error) throw readableError("Failed to update card", error);
  return rowToCard(data as CardRow);
}

export async function remove(cardId: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("cards").delete().eq("id", cardId);
  if (error) throw readableError("Failed to delete card", error);
}

export async function reorder(deckId: number, orderedIds: number[]): Promise<void> {
  const supabase = getSupabaseClient();
  const updates = orderedIds.map((id, idx) =>
    supabase.from("cards").update({ position: idx }).eq("id", id).eq("deck_id", deckId)
  );
  const results = await Promise.all(updates);
  const messages = results
    .map((r) => r.error?.message)
    .filter((m): m is string => Boolean(m));
  if (messages.length) throw new Error(`Failed to reorder cards: ${messages.join("; ")}`);
}
