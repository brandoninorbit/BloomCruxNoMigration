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
  const { data: row, error } = await sb
    .from("user_deck_quest_progress")
    .select("id, per_bloom")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching quest progress:", error);
    return NextResponse.json({ error: "failed to check progress" }, { status: 500 });
  }

  type PB = { totalMissions?: number; missionsPassed?: number; cleared?: boolean };
  const per = (row?.per_bloom ?? {}) as Record<string, PB>;
  const prevData = (per[prevLevel] ?? {}) as PB;
  const totalMissions = Number(prevData.totalMissions ?? 0);
  const missionsPassed = Number(prevData.missionsPassed ?? 0);
  const isCleared = totalMissions > 0 && missionsPassed >= totalMissions;

  if (!isCleared) {
    return NextResponse.json({
      success: false,
      message: `Complete all ${prevLevel} missions in order with at least 60% to unlock ${levelToUnlock}.`,
      missionsPassed,
      totalMissions,
    });
  }

  if (row) {
    const currentLevelData = (per[prevLevel] ?? {}) as Record<string, unknown>;
    per[prevLevel] = { ...currentLevelData, cleared: true, missionsPassed, totalMissions };
    await sb
      .from("user_deck_quest_progress")
      .update({ per_bloom: per })
      .eq("user_id", userId)
      .eq("deck_id", deckId);
  }

  return NextResponse.json({
    success: true,
    message: `${prevLevel} level unlocked!`,
    missionsPassed,
    totalMissions,
  });
}