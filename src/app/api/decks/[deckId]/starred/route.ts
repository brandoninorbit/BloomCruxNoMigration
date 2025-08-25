import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/app/supabase/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const resolved = await params;
  const deckId = Number(resolved?.deckId);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "bad deckId" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_starred_cards")
    .select("card_id")
    .eq("user_id", session.user.id)
    .eq("deck_id", deckId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (data ?? []).map((r: { card_id: number }) => Number(r.card_id));
  return NextResponse.json({ ids });
}
