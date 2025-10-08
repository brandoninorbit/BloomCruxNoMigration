import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/app/supabase/session";

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
    .from("user_deck_quest_progress")
    .select("id, per_bloom, xp")
    .eq("user_id", session.user.id)
    .eq("deck_id", deckId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, per_bloom: data.per_bloom ?? {}, xp: data.xp ?? {} });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const incomingPerBloom = body?.per_bloom as unknown;
  const incomingXp = body?.xp as unknown;

  const sb = supabaseAdmin();
  // Load existing so we can merge when one field is omitted
  const { data: existing } = await sb
    .from("user_deck_quest_progress")
    .select("id, per_bloom, xp")
    .eq("user_id", session.user.id)
    .eq("deck_id", deckId)
    .maybeSingle();

  const per_bloom = (typeof incomingPerBloom !== "undefined" ? incomingPerBloom : (existing?.per_bloom ?? {})) as Record<string, unknown>;
  const xp = (typeof incomingXp !== "undefined" ? incomingXp : (existing?.xp ?? {})) as Record<string, unknown>;

  const { data, error } = await sb
    .from("user_deck_quest_progress")
    .upsert(
      {
        user_id: session.user.id,
        deck_id: deckId,
        per_bloom,
        xp,
      },
      { onConflict: "user_id,deck_id" }
    )
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}
