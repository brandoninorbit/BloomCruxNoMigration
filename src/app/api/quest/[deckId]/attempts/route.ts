import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

function recomputeFromBreakdown(breakdown: unknown): { seen: number; correct: number } | null {
  try {
    if (!breakdown || typeof breakdown !== "object") return null;
    const obj = breakdown as Record<string, { cardsSeen?: unknown; cardsCorrect?: unknown }>;
    let seen = 0;
    let correct = 0;
    for (const k of Object.keys(obj)) {
      const v = obj[k] as { cardsSeen?: unknown; cardsCorrect?: unknown };
      const s = Math.max(0, Math.floor(Number(v?.cardsSeen ?? 0)));
      const c = Math.max(0, Math.floor(Number(v?.cardsCorrect ?? 0)));
      seen += s;
      correct += Math.min(c, s);
    }
    return { seen, correct };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const deckIdNum = Number(deckId);
  if (!Number.isFinite(deckIdNum)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });

  const sb = supabaseAdmin();
  const [{ data, error }, { data: cardsData }] = await Promise.all([
    sb
      .from("user_deck_mission_attempts")
      .select("id, mode, ended_at, bloom_level, score_pct, cards_seen, cards_correct, breakdown")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckIdNum)
      .order("ended_at", { ascending: false })
      .limit(20),
    sb
      .from("cards")
      .select("id", { count: "exact" })
      .eq("deck_id", deckIdNum)
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  const totalCards = cardsData?.length ?? 0;
  const rows = (data ?? []).map((r) => {
    const recomputed = recomputeFromBreakdown(r.breakdown);
    return {
      id: r.id,
      mode: r.mode,
      ended_at: r.ended_at,
      bloom_level: r.bloom_level,
      score_pct: Number(r.score_pct ?? 0),
      stored: { seen: Number(r.cards_seen ?? 0), correct: Number(r.cards_correct ?? 0) },
      recomputed,
      breakdown: r.breakdown ?? null,
    };
  });
  return NextResponse.json({ 
    ok: true, 
    attempts: rows,
    totalCards 
  });
}
