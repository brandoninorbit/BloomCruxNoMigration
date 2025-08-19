import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/lib/supabase/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  const body = await req.json().catch(() => ({}));
  const { bloom_level, event_type, payload } = body ?? {};

  if (!Number.isFinite(deckId) || !bloom_level || !event_type) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("user_xp_events")
    .insert({ user_id: session.user.id, deck_id: deckId, bloom_level, event_type, payload: payload ?? {} });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
