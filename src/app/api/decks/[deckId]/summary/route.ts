import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const [{ data: prog }, { data: reviewed }] = await Promise.all([
    sb
      .from("user_deck_quest_progress")
      .select("deck_mastered, deck_mastered_at")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckId)
      .maybeSingle(),
    sb
      .from("user_deck_reviewed_counts")
      .select("reviewed_cards")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckId)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    mastered: Boolean(prog?.deck_mastered ?? false),
    masteredAt: prog?.deck_mastered_at ?? null,
    reviewedCards: Number(reviewed?.reviewed_cards ?? 0),
  });
}
