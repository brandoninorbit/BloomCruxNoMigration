import { getSupabaseClient } from "@/lib/supabase/browserClient";
import type {
  DeckCard,
  DeckCardType,
  DeckBloomLevel,
  DeckStandardMCQ,
  DeckShortAnswer,
  DeckMCQMeta,
  DeckShortMeta,
  DeckFillBlank,
  DeckFillMeta,
  DeckSorting,
  DeckSortingMeta,
  DeckSequencing,
  DeckSequencingMeta,
  DeckCompareContrast,
  DeckCompareContrastMeta,
  DeckTwoTierMCQ,
  DeckTwoTierMCQMeta,
  DeckCER,
  DeckCERMeta,
} from "@/types/deck-cards";
import { defaultBloomForType } from "@/lib/bloom";
import { upsertDeckImport } from "@/lib/db/deckImports";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

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
  source?: string | null;
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
  if (row.type === "Short Answer") {
    return {
      ...base,
      type: "Short Answer",
      meta: row.meta as DeckShortMeta,
    } satisfies DeckShortAnswer;
  }
  if (row.type === "Fill in the Blank") {
    return {
      ...base,
      type: "Fill in the Blank",
      meta: row.meta as DeckFillMeta,
    } satisfies DeckFillBlank;
  }
  if (row.type === "Sorting") {
    return {
      ...base,
      type: "Sorting",
      meta: row.meta as DeckSortingMeta,
    } satisfies DeckSorting;
  }
  // Sequencing
  if (row.type === "Sequencing") return {
    ...base,
    type: "Sequencing",
    meta: row.meta as DeckSequencingMeta,
  } satisfies DeckSequencing;
  if (row.type === "Two-Tier MCQ") return {
    ...base,
    type: "Two-Tier MCQ",
    meta: row.meta as DeckTwoTierMCQMeta,
  } satisfies DeckTwoTierMCQ;
  if (row.type === "CER") return {
    ...base,
    type: "CER",
    meta: row.meta as DeckCERMeta,
  } satisfies DeckCER;
  // Compare/Contrast
  return {
    ...base,
    type: "Compare/Contrast",
    meta: row.meta as DeckCompareContrastMeta,
  } satisfies DeckCompareContrast;
}

function cardToRow(card: DeckCard): Omit<CardRow, "id" | "created_at" | "updated_at"> {
  // Runtime guards (non-transforming) to ensure meta integrity
  if (card.type === "Standard MCQ") {
    const m = (card.meta as DeckMCQMeta);
    const keys = Object.keys(m.options || {}) as Array<keyof DeckMCQMeta["options"]>;
    (['A','B','C','D'] as const).forEach((k) => { if (!keys.includes(k)) throw new Error("MCQ options must include A,B,C,D keys"); });
    if (!(['A','B','C','D'] as const).includes(m.answer)) throw new Error("MCQ answer must be one of A,B,C,D");
  }
  if (card.type === "Two-Tier MCQ") {
    const m = (card.meta as DeckTwoTierMCQMeta);
    (['A','B','C','D'] as const).forEach((k) => { if (!(k in m.tier1.options)) throw new Error("Two-Tier tier1 options require A..D"); });
    (['A','B','C','D'] as const).forEach((k) => { if (!(k in m.tier2.options)) throw new Error("Two-Tier tier2 options require A..D"); });
    if (!(['A','B','C','D'] as const).includes(m.tier1.answer)) throw new Error("Two-Tier tier1 answer must be A..D");
    if (!(['A','B','C','D'] as const).includes(m.tier2.answer)) throw new Error("Two-Tier tier2 answer must be A..D");
  }
  if (card.type === "Fill in the Blank") {
    const m = (card.meta as DeckFillMeta);
    const isV3 = (mm: DeckFillMeta): mm is import("@/types/deck-cards").DeckFillMetaV3 => (mm as import("@/types/deck-cards").DeckFillMetaV3).blanks !== undefined;
  const hasProp = <T extends object>(obj: T, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);
  const isV2 = (mm: DeckFillMeta): mm is import("@/types/deck-cards").DeckFillMetaV2 => hasProp(mm as object, "answers") && !hasProp(mm as object, "blanks");
  const isV1 = (mm: DeckFillMeta): mm is import("@/types/deck-cards").DeckFillMetaV1 => hasProp(mm as object, "answer") && !hasProp(mm as object, "answers") && !hasProp(mm as object, "blanks");
    if (isV3(m)) {
      if (!Array.isArray(m.blanks)) throw new Error("Fill-V3 blanks must be an array");
      m.blanks.forEach((b, idx) => {
        if (!b || !Array.isArray(b.answers)) throw new Error(`Fill-V3 blank ${idx + 1} missing answers array`);
      });
    } else if (isV2(m)) {
      if (!Array.isArray(m.answers)) throw new Error("Fill-V2 answers must be an array");
    } else if (!isV1(m)) {
      throw new Error("Fill meta must be V1/V2/V3");
    }
  }
  return {
    deck_id: card.deckId,
    type: card.type,
    bloom_level: (card.bloomLevel ?? defaultBloomForType(card.type)) ?? null,
    question: card.question,
    explanation: card.explanation ?? null,
    meta: card.meta,
    position: card.position ?? null,
  // 
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
  meta: DeckMCQMeta | DeckShortMeta | DeckFillMeta | DeckSortingMeta | DeckSequencingMeta | DeckCompareContrastMeta | DeckTwoTierMCQMeta | DeckCERMeta;
  position?: number;
  source?: string | null;
  // NOTE: CER handled by widened union below in create/update calls using DeckCard typing.
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
  const rowBase = cardToRow({
    id: 0 as unknown as number,
    deckId: input.deckId,
    type: input.type,
    bloomLevel: input.bloomLevel ?? defaultBloomForType(input.type),
    question: input.question,
    explanation: input.explanation,
    meta: input.meta,
    position: input.position,
  } as DeckCard);
  // Inject 'source' only at insert time with a typed object
  const row: Omit<CardRow, "id" | "created_at" | "updated_at"> = {
    ...rowBase,
    source: input.source ?? null,
  };
  const { error } = await supabase
    .from("cards")
    .insert([row])
    .select("id")
    .single();

  if (error) throw readableError("Failed to create card", error);
  // Re-fetch latest created row to return full shape
  const { data: fresh, error: getErr } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", input.deckId)
    .order("id", { ascending: false })
    .limit(1)
    .single();
  if (getErr) throw readableError("Failed to load created card", getErr);
  return rowToCard(fresh as CardRow);
}

// Bulk insert cards for faster CSV imports
export async function createMany(inputs: NewDeckCard[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const supabase = getSupabaseClient();
  const rows: Omit<CardRow, "id" | "created_at" | "updated_at">[] = inputs.map((input) => {
    const rowBase = cardToRow({
      id: 0 as unknown as number,
      deckId: input.deckId,
      type: input.type,
      bloomLevel: input.bloomLevel ?? defaultBloomForType(input.type),
      question: input.question,
      explanation: input.explanation,
      meta: input.meta,
      position: input.position,
    } as DeckCard);
    return { ...rowBase, source: input.source ?? null };
  });
  const { error, count } = await supabase
    .from("cards")
    .insert(rows, { count: "exact" });
  if (error) throw readableError("Failed to bulk create cards", error);
  return (count as number) ?? inputs.length;
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

// Bulk delete by deck and source tag
export async function removeBySource(deckId: number, source: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { error, count } = await supabase
    .from("cards")
    .delete({ count: "exact" })
    .eq("deck_id", deckId)
    .eq("source", source);
  if (error) throw readableError("Failed to delete by source", error);
  return (count as number) ?? 0;
}

// Distinct list of non-null import sources for a deck
export async function listSourcesByDeck(deckId: number): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("cards")
    .select("source")
    .eq("deck_id", deckId)
    .not("source", "is", null);
  if (error) throw readableError("Failed to list deck sources", error);
  const set = new Set<string>();
  for (const r of (data ?? []) as { source: string | null }[]) {
    if (r.source && r.source.trim()) set.add(r.source.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ----- Import hash tracking (deck_imports) -----
export async function hasImportHash(deckId: number, fileHash: string): Promise<boolean> {
  const supabase = createClientComponentClient<Database>();
  const { data, error } = await supabase
    .from("deck_imports")
    .select("id")
    .eq("deck_id", deckId)
    .eq("file_hash", fileHash)
    .maybeSingle();
  if (error && error.code !== "PGRST116") return false;
  return Boolean((data as { id?: number } | null)?.id);
}

export async function recordImportHash(deckId: number, source: string, fileHash: string): Promise<void> {
  await upsertDeckImport({ deckId, fileHash, source });
}
