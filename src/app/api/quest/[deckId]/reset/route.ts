import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/app/supabase/session";

// POST to reset quest state for this deck and current user.
// Body: { wipeXp?: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const wipeXp = !!body?.wipeXp;

  const sb = supabaseAdmin();
  const results: Record<string, string | number> = {};

  // Delete missions across all bloom levels for this deck
  {
    const { error } = await sb
      .from("user_deck_missions")
      .delete()
      .eq("user_id", userId)
      .eq("deck_id", deckId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    results.missionsCleared = 1;
  }

  // Delete mission attempts for this deck
  {
    const { error } = await sb
      .from("user_deck_mission_attempts")
      .delete()
      .eq("user_id", userId)
      .eq("deck_id", deckId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    results.attemptsCleared = 1;
  }

  // Delete SRS performance for this deck
  {
    const { error } = await sb
      .from("user_deck_srs")
      .delete()
      .eq("user_id", userId)
      .eq("deck_id", deckId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    results.srsCleared = 1;
  }

  // Reset per-bloom progress and xp for this deck
  {
    const { error } = await sb
      .from("user_deck_quest_progress")
      .delete()
      .eq("user_id", userId)
      .eq("deck_id", deckId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    results.progressCleared = 1;
  }

  // Re-seed per_bloom with current deck totals (so totals match cards right after reset)
  {
    const { data: cards } = await sb
      .from("cards")
      .select("bloom_level")
      .eq("deck_id", deckId);
    const by: Record<string, number> = { Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0 };
    for (const r of (cards ?? []) as Array<{ bloom_level: string | null }>) {
      const lvl = (r.bloom_level ?? "Remember") as keyof typeof by;
      by[lvl] = (by[lvl] ?? 0) + 1;
    }
    const cap = 50; // missionCap default
    const per_bloom: Record<string, unknown> = {};
    (Object.keys(by) as Array<keyof typeof by>).forEach((lvl) => {
      const totalCards = by[lvl] ?? 0;
      per_bloom[lvl] = {
        totalCards,
        totalMissions: Math.ceil(totalCards / cap) || 0,
        completedCards: 0,
        missionsCompleted: 0,
        masteryPercent: 0,
        mastered: false,
        commanderGranted: false,
        accuracySum: 0,
        accuracyCount: 0,
        recentAttempts: [],
        weightedAvg: 0,
        cleared: false,
      };
    });
    await sb
      .from("user_deck_quest_progress")
      .upsert({ user_id: userId, deck_id: deckId, per_bloom, xp: {} }, { onConflict: "user_id,deck_id" });
  }

  if (wipeXp) {
    const { error } = await sb
      .from("user_xp_events")
      .delete()
      .eq("user_id", userId)
      .eq("deck_id", deckId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    results.xpEventsCleared = 1;
  }

  return NextResponse.json({ ok: true, ...results });
}
