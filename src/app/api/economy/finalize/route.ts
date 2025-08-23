import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/lib/supabase/session";

// Finalize a mission completion by minting commander XP and tokens to the user's wallet.
// Body: { deckId: number, mode?: string, correct?: number, total?: number, percent?: number }
// Policy: idempotent per matching (deckId, mode, correct, total) within a short window.
type FinalizeBody = { deckId?: unknown; mode?: unknown; correct?: unknown; total?: unknown; percent?: unknown };

export async function POST(req: NextRequest) {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as FinalizeBody;
  const deckId = Number(body?.deckId ?? NaN);
  const mode = String(body?.mode ?? "remix");
  const correct = Number(body?.correct ?? NaN);
  const total = Number(body?.total ?? NaN);
  const percent = Number(body?.percent ?? (Number.isFinite(correct) && Number.isFinite(total) && total > 0 ? (correct / total) * 100 : NaN));

  if (!Number.isFinite(deckId) || deckId <= 0) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  if (!Number.isFinite(correct) || correct < 0) return NextResponse.json({ error: "invalid correct" }, { status: 400 });
  if (!Number.isFinite(total) || total < 0) return NextResponse.json({ error: "invalid total" }, { status: 400 });
  const pct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;

  const commanderDelta = Math.round(Math.max(0, correct)); // simple: 1 commander XP per correct
  const tokensDelta = Math.max(0, Math.round(commanderDelta * 0.25)); // 0.25 tokens per XP

  const sb = supabaseAdmin();

  // Idempotency: if a matching mission_completed for this payload exists recently, do not double-apply
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: existing } = await sb
    .from("user_xp_events")
    .select("id, payload, created_at")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("event_type", "mission_completed")
    .gte("created_at", fifteenMinAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  const already = (existing ?? []).some((e) => {
    try {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const m = String(p["mode"] ?? "");
      const c = Number(p["correct"] ?? NaN);
      const t = Number(p["total"] ?? NaN);
      return m === mode && Number.isFinite(c) && Number.isFinite(t) && c === correct && t === total;
    } catch { return false; }
  });

  if (!already) {
    // Log mission_completed and commander XP event for audit
    const payload = { mode, correct, total, percent: pct };
    const { error: e1 } = await sb
      .from("user_xp_events")
      .insert({ user_id: userId, deck_id: deckId, bloom_level: "Remember", event_type: "mission_completed", payload });
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    if (commanderDelta > 0) {
      const { error: e2 } = await sb
        .from("user_xp_events")
        .insert({ user_id: userId, deck_id: deckId, bloom_level: "Remember", event_type: "xp_commander_added", payload: { amount: commanderDelta, mode } });
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    }

    // Upsert wallet totals via RPC to increment
    const { error: e3 } = await sb.rpc("increment_user_economy", { p_user_id: userId, p_tokens_delta: tokensDelta, p_xp_delta: commanderDelta });
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
  }

  // Return wallet
  const { data: walletRow, error } = await sb.from("user_economy").select("tokens, commander_xp").eq("user_id", userId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tokens: Number(walletRow?.tokens ?? 0), commander_xp: Number(walletRow?.commander_xp ?? 0) });
}
