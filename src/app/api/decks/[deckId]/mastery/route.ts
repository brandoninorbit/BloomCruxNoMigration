import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { DeckBloomLevel } from "@/types/deck-cards";

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_deck_bloom_mastery")
    .select("bloom_level, mastery_pct")
    .eq("user_id", session.user.id)
    .eq("deck_id", deckId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const map: Partial<Record<DeckBloomLevel, number>> = {};
  for (const row of (data ?? []) as Array<{ bloom_level: DeckBloomLevel; mastery_pct: number | null }>) {
    const pctRaw = typeof row.mastery_pct === "number" ? row.mastery_pct : 0;
    const pct = pctRaw > 0 && pctRaw <= 1 ? pctRaw * 100 : pctRaw;
    map[row.bloom_level] = pct;
  }
  return NextResponse.json({ found: true, mastery: map });
}
