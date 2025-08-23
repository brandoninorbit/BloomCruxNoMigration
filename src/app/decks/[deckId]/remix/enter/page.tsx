import { notFound } from "next/navigation";
import { BLOOM_COLOR_HEX, BLOOM_LEVELS } from "@/types/card-catalog";
import type { DeckBloomLevel, DeckCardType } from "@/types/deck-cards";
import { supabaseAdmin } from "@/lib/supabase/server";
import RemixEnterClient from "./RemixEnterClient";

export const dynamic = "force-dynamic";

type Counts = {
  total: number;
  perBloom: Partial<Record<DeckBloomLevel, number>>;
  perType: Partial<Record<DeckCardType, number>>;
};

export default async function RemixEnterPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const id = Number(deckId);
  if (!Number.isFinite(id)) notFound();

  const sb = supabaseAdmin();
  let counts: Counts = { total: 0, perBloom: {}, perType: {} };
  try {
    const { data } = await sb
      .from("cards")
      .select("bloom_level, type")
      .eq("deck_id", id);
    const rows = (data ?? []) as { bloom_level: DeckBloomLevel | null; type: DeckCardType }[];
    const perBloom: Partial<Record<DeckBloomLevel, number>> = {};
    const perType: Partial<Record<DeckCardType, number>> = {};
    for (const r of rows) {
      const lvl = (r.bloom_level ?? "Remember") as DeckBloomLevel;
      perBloom[lvl] = (perBloom[lvl] ?? 0) + 1;
      perType[r.type] = (perType[r.type] ?? 0) + 1;
    }
    counts = { total: rows.length, perBloom, perType };
  } catch {}

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Random Remix</h1>
        <a href={`/decks/${id}/study`} className="text-sm text-blue-700 hover:underline">Back to Study</a>
      </div>

      <div className="mb-4 text-sm text-slate-700">
        <div className="mb-2">Deck total: <span className="font-semibold">{counts.total}</span> cards</div>
        <div className="flex flex-wrap gap-2">
          {(BLOOM_LEVELS as DeckBloomLevel[]).map((lvl) => (
            <span key={lvl} className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs text-white" style={{ backgroundColor: BLOOM_COLOR_HEX[lvl] }}>
              {lvl}
              <span className="bg-white/20 px-1.5 py-0.5 rounded">{counts.perBloom[lvl] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <RemixEnterClient deckId={id} counts={counts} />
      </div>
    </main>
  );
}
