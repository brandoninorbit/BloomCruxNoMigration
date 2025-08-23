import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/lib/supabase/session";

// Query string expects bloomLevel and missionIndex
export async function GET(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  const url = new URL(req.url);
  const bloomLevel = url.searchParams.get("bloomLevel");
  const missionIndex = Number(url.searchParams.get("missionIndex") ?? 0);

  if (!Number.isFinite(deckId) || !bloomLevel) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_deck_missions")
    .select("id, sequence_seed, card_order, answered, started_at, resumed_at, completed_at")
    .eq("user_id", session.user.id)
    .eq("deck_id", deckId)
    .eq("bloom_level", bloomLevel)
    .eq("mission_index", missionIndex)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, mission: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  const body = await req.json().catch(() => ({}));
  const { bloom_level, mission_index, sequence_seed, card_order, answered, started_at, resumed_at, completed_at } = body ?? {};

  if (!Number.isFinite(deckId) || !bloom_level || !Array.isArray(card_order)) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  // Policy:
  // - If a mission is ongoing (completed_at null), upsert by (user,deck,bloom,mission_index) to allow resume.
  // - If a mission is completed (completed_at provided), insert a new row and do NOT overwrite prior missions.
  let data: { id?: number } | null = null;
  let error: { message: string } | null = null;
  if (completed_at) {
    // Completed mission: insert a new row explicitly. If mission_index is not provided, compute the next index.
    let mi = Number.isFinite(Number(mission_index)) ? Number(mission_index) : 0;
    try {
      const { data: maxRow } = await sb
        .from("user_deck_missions")
        .select("mission_index")
        .eq("user_id", session.user.id)
        .eq("deck_id", deckId)
        .eq("bloom_level", bloom_level)
        .order("mission_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const maxIdx = Number(maxRow?.mission_index ?? -1);
      mi = Number.isFinite(mi) && mi > maxIdx ? mi : maxIdx + 1;
    } catch {}
    const ins = await sb
      .from("user_deck_missions")
      .insert({
        user_id: session.user.id,
        deck_id: deckId,
        bloom_level,
        mission_index: mi,
        sequence_seed,
        card_order,
        answered: answered ?? [],
        started_at: started_at ?? new Date().toISOString(),
        resumed_at: resumed_at ?? null,
        completed_at,
      })
      .select("id")
      .maybeSingle();
    data = ins.data as { id?: number } | null;
    error = ins.error as { message: string } | null;
  } else {
    const up = await sb
      .from("user_deck_missions")
      .upsert(
        {
          user_id: session.user.id,
          deck_id: deckId,
          bloom_level,
          mission_index: mission_index ?? 0,
          sequence_seed,
          card_order,
          answered: answered ?? [],
          started_at: started_at ?? new Date().toISOString(),
          resumed_at: resumed_at ?? null,
          completed_at: null,
        },
        { onConflict: "user_id,deck_id,bloom_level,mission_index" }
      )
      .select("id")
      .maybeSingle();
    data = up.data as { id?: number } | null;
    error = up.error as { message: string } | null;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}
