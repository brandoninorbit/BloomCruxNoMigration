import { notFound } from "next/navigation";
import { BLOOM_LEVELS, BLOOM_COLOR_HEX } from "@/types/card-catalog";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { supabaseAdmin } from "@/lib/supabase/server";
import LevelUpEnterClient from "../LevelUpEnterClient";
import { getSupabaseSession } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

type Counts = { total: number; perBloom: Partial<Record<DeckBloomLevel, number>> };

export default async function LevelUpEnterPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const id = Number(deckId);
  if (!Number.isFinite(id)) notFound();

  const sb = supabaseAdmin();
  let counts: Counts = { total: 0, perBloom: {} };
  let mastery: Partial<Record<DeckBloomLevel, number>> = {};
  try {
    const { data } = await sb
      .from("cards")
      .select("bloom_level")
      .eq("deck_id", id);
    const rows = (data ?? []) as { bloom_level: DeckBloomLevel | null }[];
    const perBloom: Partial<Record<DeckBloomLevel, number>> = {};
    for (const r of rows) {
      const lvl = (r.bloom_level ?? "Remember") as DeckBloomLevel;
      perBloom[lvl] = (perBloom[lvl] ?? 0) + 1;
    }
    counts = { total: rows.length, perBloom };
  } catch {}

  try {
    const session = await getSupabaseSession();
    if (session?.user?.id) {
      const { data } = await sb
        .from("user_deck_bloom_mastery")
        .select("bloom_level, mastery_pct")
        .eq("deck_id", id)
        .eq("user_id", session.user.id);
      const map: Partial<Record<DeckBloomLevel, number>> = {};
      for (const row of (data ?? []) as Array<{ bloom_level: DeckBloomLevel; mastery_pct: number | null }>) {
        const pctRaw = typeof row.mastery_pct === "number" ? row.mastery_pct : 0;
        const pct = pctRaw > 0 && pctRaw <= 1 ? pctRaw * 100 : pctRaw;
        map[row.bloom_level] = pct;
      }
      mastery = map;
    }
  } catch {}

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Level Up</h1>
        <a href={`/decks/${id}/study`} className="text-sm text-blue-700 hover:underline">Back to Study</a>
      </div>

      <div className="mb-4 text-sm text-slate-700">
        <div className="mb-2">Deck size: <span className="font-semibold">{counts.total}</span> cards</div>
        <div className="flex flex-wrap gap-2">
          {(BLOOM_LEVELS as DeckBloomLevel[]).map((lvl) => (
            <span key={lvl} className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs text-white" style={{ backgroundColor: BLOOM_COLOR_HEX[lvl] }}>
              {lvl}
              <span className="bg-white/20 px-1.5 py-0.5 rounded">{counts.perBloom[lvl] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      <LevelUpEnterClient deckId={id} counts={counts} mastery={mastery} />
    </main>
  );
}
