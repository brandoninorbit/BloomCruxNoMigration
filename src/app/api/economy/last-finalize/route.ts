import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/app/supabase/session";

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const deckId = Number(searchParams.get("deckId") ?? NaN);
  if (!Number.isFinite(deckId) || deckId <= 0) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: events, error } = await sb
    .from("user_xp_events")
    .select("event_type, created_at, payload")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // find most recent mission_completed
  const completedIdx = (events ?? []).findIndex((e) => e.event_type === "mission_completed");
  if (completedIdx < 0) return NextResponse.json({ found: false });
  const completed = events![completedIdx]!;
  const endTime = new Date(completed.created_at as string).getTime();
  const postWindowMs = 30 * 1000;
  // sum xp_commander_added between completion and +30s inclusive
  let xpDelta = 0;
  for (let i = 0; i < completedIdx; i++) {
    const e = events![i]!;
    if (e.event_type !== "xp_commander_added") continue;
    const t = new Date(e.created_at as string).getTime();
    if (t >= endTime && t <= endTime + postWindowMs) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const amt = Number(p["amount"] ?? NaN);
      if (Number.isFinite(amt)) xpDelta += amt;
    }
  }
  // Get tokens awarded for this mission from telemetry
  const { data: tokenEvents, error: tokenError } = await sb
    .from('token_telemetry')
    .select('tokens_earned')
    .eq('user_id', userId)
    .eq('event_type', 'mission_completion')
    .eq('deck_id', deckId)
    .gte('created_at', new Date(endTime).toISOString())
    .lte('created_at', new Date(endTime + postWindowMs).toISOString());

  let tokensDelta = 0;
  if (!tokenError && tokenEvents) {
    tokensDelta = tokenEvents.reduce((sum, event) => sum + Number(event.tokens_earned || 0), 0);
  }

  return NextResponse.json({ found: true, xpDelta, tokensDelta, completedAt: completed.created_at });
}
