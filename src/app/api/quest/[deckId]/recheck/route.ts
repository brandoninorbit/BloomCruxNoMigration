import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { BLOOM_LEVELS } from "@/types/card-catalog";

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const levelToUnlock = body?.level as DeckBloomLevel | undefined;
  if (!levelToUnlock || !BLOOM_LEVELS.includes(levelToUnlock)) {
    return NextResponse.json({ error: "invalid level" }, { status: 400 });
  }

  // Find the previous level that should be checked
  const levelIndex = BLOOM_LEVELS.indexOf(levelToUnlock);
  if (levelIndex === 0) {
    return NextResponse.json({ error: "cannot recheck first level" }, { status: 400 });
  }
  const prevLevel = BLOOM_LEVELS[levelIndex - 1] as DeckBloomLevel;

  const sb = supabaseAdmin();

  // Find attempts for the previous level, ordered by mission index descending, then by score descending
  const { data: attempts, error } = await sb
    .from("user_deck_mission_attempts")
    .select("score_pct, mode, mission_index")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("bloom_level", prevLevel)
    .eq("mode", "quest")
    .order("mission_index", { ascending: false })
    .order("score_pct", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching attempts:", error);
    return NextResponse.json({ error: "failed to check attempts" }, { status: 500 });
  }

  const latestAttempt = attempts?.[0];
  if (!latestAttempt || latestAttempt.score_pct < 60) {
    return NextResponse.json({
      success: false,
      message: "Earlier missions do not demonstrate sufficient knowledge to advance, study and return later",
      latestScore: latestAttempt?.score_pct ?? 0,
      missionIndex: latestAttempt?.mission_index ?? 0
    });
  }

  // The highest mission has >=60% accuracy, so unlock the level
  const { data: row } = await sb
    .from("user_deck_quest_progress")
    .select("id, per_bloom")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .maybeSingle();

  if (row) {
    const per = (row.per_bloom ?? {}) as Record<string, unknown>;
    const currentLevelData = (per[prevLevel] ?? {}) as Record<string, unknown>;
    per[prevLevel] = { ...currentLevelData, cleared: true };
    await sb
      .from("user_deck_quest_progress")
      .update({ per_bloom: per })
      .eq("user_id", userId)
      .eq("deck_id", deckId);
  }

  return NextResponse.json({
    success: true,
    message: `${prevLevel} level unlocked!`,
    latestScore: latestAttempt.score_pct,
    missionIndex: latestAttempt.mission_index
  });
}