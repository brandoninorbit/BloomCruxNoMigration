import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/app/supabase/session";

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
          // Normalize to integers and non-negative
          const attempts = Math.max(0, Math.floor(obj.attempts));
          const correct = Math.max(0, Math.floor(obj.correct));
          return { cardId: obj.cardId, attempts, correct, lastSeenAt: obj.lastSeenAt ?? null } as SrsUpdate;
        })
        .filter((v): v is SrsUpdate => v !== null)
    : [];
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  if (updates.length === 0) return NextResponse.json({ ok: true, updated: 0 });

  // Fetch existing to compute safe deltas and clamp extremes
  const cardIds = updates.map((u) => u.cardId);
  const { data: existingRows, error: readErr } = await sb
    .from("user_deck_srs")
    .select("card_id, attempts, correct")
    .eq("user_id", session.user.id)
    .eq("deck_id", deckId)
    .in("card_id", cardIds);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  const existing = new Map<number, { attempts: number; correct: number }>();
  for (const r of existingRows ?? []) existing.set(Number(r.card_id), { attempts: Number(r.attempts ?? 0), correct: Number(r.correct ?? 0) });

  // Reasonable caps
  const MAX_INCREMENT_ATTEMPTS_PER_CALL = 200; // per card, per POST
  const MAX_TOTAL_ATTEMPTS_PER_CARD = 10000;

  const rows = updates.map((u) => {
    const prev = existing.get(u.cardId) ?? { attempts: 0, correct: 0 };
    // Compute deltas
    let dAtt = Math.max(0, Math.floor(u.attempts - prev.attempts));
    let dCor = Math.max(0, Math.floor(u.correct - prev.correct));
    // Clamp deltas
    if (dAtt > MAX_INCREMENT_ATTEMPTS_PER_CALL) dAtt = MAX_INCREMENT_ATTEMPTS_PER_CALL;
    if (dCor > dAtt) dCor = dAtt;
    // Apply to totals and clamp totals
    let attempts = prev.attempts + dAtt;
    let correct = prev.correct + dCor;
    if (attempts > MAX_TOTAL_ATTEMPTS_PER_CARD) attempts = MAX_TOTAL_ATTEMPTS_PER_CARD;
    if (correct > attempts) correct = attempts;
    return {
      user_id: session.user.id,
      deck_id: deckId,
      card_id: u.cardId,
      attempts,
      correct,
      last_seen_at: u.lastSeenAt ?? null,
    };
  });

  const { error } = await sb.from("user_deck_srs").upsert(rows, { onConflict: "user_id,deck_id,card_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: rows.length });
}
