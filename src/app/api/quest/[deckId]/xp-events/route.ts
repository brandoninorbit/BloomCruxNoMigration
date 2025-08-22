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

// Returns a small summary for the latest mission window for this deck
export async function GET(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_xp_events")
    .select("event_type, bloom_level, payload, created_at")
    .eq("user_id", session.user.id)
    .eq("deck_id", deckId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const events = data ?? [];

  const idx = events.findIndex((e) => e.event_type === "mission_completed");
  if (idx < 0) return NextResponse.json({ found: false });
  const completed = events[idx]!;
  const tail = events.slice(idx + 1);
  const startedIdx = tail.findIndex((e) => e.event_type === "mission_started");
  const started = startedIdx >= 0 ? tail[startedIdx] : null;
  const prevCompletedIdx = tail.findIndex((e) => e.event_type === "mission_completed");
  const prevCompleted = prevCompletedIdx >= 0 ? tail[prevCompletedIdx] : null;

  const endTime = new Date(completed.created_at as string).getTime();
  const postWindowMs = 30 * 1000;
  const startTime = started
    ? new Date(started.created_at as string).getTime()
    : prevCompleted
    ? new Date(prevCompleted.created_at as string).getTime()
    : endTime - 6 * 60 * 60 * 1000;

  let xpEarned = 0;
  for (const e of events) {
    const t = new Date(e.created_at as string).getTime();
    const isXp = e.event_type === "xp_bloom_added" || e.event_type === "xp_commander_added";
    const withinWindow = t > startTime && t <= endTime;
    const withinPost = isXp && t > endTime && t <= endTime + postWindowMs;
    if (!withinWindow && !withinPost) continue;
    if (isXp) {
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      const amtRaw = payload["amount"];
      const amt = typeof amtRaw === "number" ? amtRaw : Number(amtRaw ?? 0);
      if (!Number.isNaN(amt)) xpEarned += amt;
    }
  }

  const p = (completed.payload ?? {}) as Record<string, unknown>;
  const correct = typeof p["correct"] === "number" ? (p["correct"] as number) : Number(p["correct"] ?? 0);
  const total = typeof p["total"] === "number" ? (p["total"] as number) : Number(p["total"] ?? 0);
  const percent = typeof p["percent"] === "number"
    ? (p["percent"] as number)
    : (total > 0 ? Math.round(((correct / total) * 100) * 10) / 10 : 0);
  return NextResponse.json({
    found: true,
    bloom_level: completed.bloom_level,
    completed_at: completed.created_at,
    correct,
    total,
    percent,
    xp_earned: xpEarned,
  });
}
