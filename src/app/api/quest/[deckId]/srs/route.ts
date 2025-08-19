import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/lib/supabase/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_deck_srs")
    .select("card_id, attempts, correct, last_seen_at")
    .eq("user_id", session.user.id)
    .eq("deck_id", deckId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ srs: (data ?? []).map((r) => ({
    cardId: Number(r.card_id),
    attempts: r.attempts ?? 0,
    correct: r.correct ?? 0,
    lastSeenAt: r.last_seen_at ?? null,
  })) });
}

type SrsUpdate = { cardId: number; attempts: number; correct: number; lastSeenAt?: string | null };

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  const body = await req.json().catch(() => ({}));
  const updates: SrsUpdate[] = Array.isArray(body?.updates)
    ? (body.updates as unknown[])
        .map((u) => {
          const obj = u as Partial<SrsUpdate>;
          if (typeof obj?.cardId !== "number" || typeof obj?.attempts !== "number" || typeof obj?.correct !== "number") return null;
          return { cardId: obj.cardId, attempts: obj.attempts, correct: obj.correct, lastSeenAt: obj.lastSeenAt ?? null } as SrsUpdate;
        })
        .filter((v): v is SrsUpdate => v !== null)
    : [];
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const rows = updates.map((u) => ({
    user_id: session.user.id,
    deck_id: deckId,
    card_id: u.cardId,
    attempts: u.attempts,
    correct: u.correct,
    last_seen_at: u.lastSeenAt ?? null,
  }));

  const { error } = await sb
    .from("user_deck_srs")
    .upsert(rows, { onConflict: "user_id,deck_id,card_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
