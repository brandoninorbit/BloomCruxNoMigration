import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { XP_MODEL, type BloomLevel } from "@/lib/xp";

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deckId = Number(searchParams.get("deckId") ?? NaN);
  const sinceDays = Number(searchParams.get("days") ?? 60);
  const sinceIso = new Date(Date.now() - Math.max(1, sinceDays) * 24 * 60 * 60 * 1000).toISOString();

  const sb = supabaseAdmin();
  const userId = session.user.id;

  // Pull mission_completed and other XP events
  const { data: events, error } = await sb
    .from("user_xp_events")
    .select("event_type, created_at, payload, deck_id")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const windows = (events ?? []).filter((e) => e.event_type === "mission_completed" && (Number.isNaN(deckId) || Number(e.deck_id) === deckId));

  let expected = 0;
  for (const w of windows) {
    try {
      const p = (w.payload ?? {}) as { breakdown?: Partial<Record<BloomLevel, { correct?: number; total?: number }>>; correct?: number; total?: number; percent?: number };
      let inc = 0;
      if (p.breakdown && Object.keys(p.breakdown).length > 0) {
        const map: Partial<Record<BloomLevel, { correct: number; total: number }>> = {};
        for (const k of Object.keys(p.breakdown) as BloomLevel[]) {
          const raw = (p.breakdown as Partial<Record<BloomLevel, unknown>>)[k];
          const v = (raw && typeof raw === 'object' ? raw : {}) as { correct?: number; total?: number };
          const c = Math.max(0, Math.floor(Number(v?.correct ?? 0)));
          const t = Math.max(0, Math.floor(Number(v?.total ?? 0)));
          if (t > 0) map[k] = { correct: Math.min(c, t), total: t };
        }
        inc = XP_MODEL.awardForBreakdown(map);
      } else {
        const c = Math.max(0, Math.floor(Number(p.correct ?? 0)));
        const t = Math.max(0, Math.floor(Number(p.total ?? 0)));
        inc = XP_MODEL.awardForMission({ correct: Math.min(c, t), total: t, bloom: "Remember" });
      }
      expected += inc;
    } catch {}
  }

  // Also include other commander XP events
  const otherXpEvents = (events ?? []).filter((e) => e.event_type === "xp_commander_added" && (Number.isNaN(deckId) || Number(e.deck_id) === deckId));
  for (const e of otherXpEvents) {
    try {
      const p = (e.payload ?? {}) as { amount?: number };
      const amt = Number(p.amount ?? 0);
      if (Number.isFinite(amt)) expected += amt;
    } catch {}
  }

  // Current wallet
  const { data: wallet, error: werr } = await sb
    .from("user_economy")
    .select("commander_xp, commander_level")
    .eq("user_id", userId)
    .maybeSingle();
  if (werr) return NextResponse.json({ error: werr.message }, { status: 500 });
  const commander_xp = Number(wallet?.commander_xp ?? 0);

  const delta = expected - commander_xp;
  return NextResponse.json({ ok: true, expected, commander_xp, delta, windows: windows.length, otherXpEvents: otherXpEvents.length });
}

export async function POST(req: NextRequest) {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Admin-only: check if user ID is in a hardcoded list or has admin role
  const adminUserIds = process.env.ADMIN_USER_IDS?.split(',') || [];
  if (!adminUserIds.includes(session.user.id)) {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const delta = Number(body?.delta ?? NaN);
  if (!Number.isFinite(delta) || delta <= 0) {
    return NextResponse.json({ error: "invalid delta" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const userId = session.user.id;

  // Get current wallet
  const { data: wallet, error: werr } = await sb
    .from("user_economy")
    .select("commander_xp, commander_level")
    .eq("user_id", userId)
    .maybeSingle();
  if (werr) return NextResponse.json({ error: werr.message }, { status: 500 });

  const currentXp = Number(wallet?.commander_xp ?? 0);
  const newXp = currentXp + delta;
  const newLevel = XP_MODEL.progressFor(newXp).level;

  // Update wallet
  const { error: uerr } = await sb
    .from("user_economy")
    .update({ commander_xp: newXp, commander_level: newLevel })
    .eq("user_id", userId);
  if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 });

  return NextResponse.json({ ok: true, oldXp: currentXp, newXp, newLevel, delta });
}
