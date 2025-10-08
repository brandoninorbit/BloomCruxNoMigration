import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { getAttemptWeightedAccuracy } from "@/server/mastery/updateBloomMastery";
import { supabaseAdmin } from "@/lib/supabase/server";

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  const level = (req.nextUrl.searchParams.get("level") || "") as DeckBloomLevel;
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  if (!level) return NextResponse.json({ error: "missing level" }, { status: 400 });

  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const awa = await getAttemptWeightedAccuracy(session.user.id, deckId, level);
    // Also return retention and mastery for context (optional)
    const sb = supabaseAdmin();
    const { data: row } = await sb
      .from("user_deck_bloom_mastery")
      .select("retention_strength, mastery_pct, coverage")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckId)
      .eq("bloom_level", level)
      .maybeSingle();
    const retention = Math.max(0, Math.min(1, Number(row?.retention_strength ?? 0)));
    const masteryPct = Math.max(0, Math.min(100, Number(row?.mastery_pct ?? 0)));
    const coverage = Math.max(0, Math.min(1, Number(row?.coverage ?? 0)));
    return NextResponse.json({ awa, retention, coverage, masteryPct });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
