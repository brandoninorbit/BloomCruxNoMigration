import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/app/supabase/session";
import type { CardMastery } from "@/types/mastery";
import { struggleQueue } from "@/lib/reviewQueues";

export async function GET() {
  // Prefer POST with explicit cardIds; GET not supported to avoid large query strings or schema coupling
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const cardIds: number[] = Array.isArray(body?.cardIds)
    ? (body.cardIds as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : [];
  if (cardIds.length === 0) return NextResponse.json({ ids: [] });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_card_state")
    .select("card_id, state")
    .eq("user_id", session.user.id)
    .in("card_id", cardIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  type Row = { card_id: number | string; state: unknown };
  const states: { cardId: number; state: CardMastery }[] = ((data ?? []) as Row[])
    .map((r) => ({ cardId: Number(r.card_id), state: (r.state ?? null) as CardMastery | null }))
    .filter((r) => Number.isFinite(r.cardId) && r.state !== null) as { cardId: number; state: CardMastery }[];

  if (states.length === 0) return NextResponse.json({ ids: [] });

  const queue = struggleQueue(states.map((r) => r.state));
  const order = new Map(queue.map((s, idx) => [s.cardId, idx] as const));
  const ids = states
    .map((r) => r.cardId)
    .sort((a, b) => (order.get(String(a)) ?? Number.POSITIVE_INFINITY) - (order.get(String(b)) ?? Number.POSITIVE_INFINITY));

  return NextResponse.json({ ids });
}
