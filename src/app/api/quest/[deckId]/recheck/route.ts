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

  type AttemptRow = { score_pct: number | string | null; mode?: string | null; ended_at: string | null };
  let attempts: AttemptRow[] | null = null;
  let error: unknown = null;

  const primary = await sb
    .from("user_deck_mission_attempts")
    .select("score_pct, mode, ended_at")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("bloom_level", prevLevel)
    .eq("mode", "quest")
    .order("ended_at", { ascending: false })
    .order("score_pct", { ascending: false })
    .limit(1);

  attempts = primary.data as AttemptRow[] | null;
  error = primary.error;

  const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error as { message?: unknown }).message : undefined;
  if (typeof errorMessage === 'string' && errorMessage.includes('mode')) {
    const fallback = await sb
      .from("user_deck_mission_attempts")
      .select("score_pct, ended_at")
      .eq("user_id", userId)
      .eq("deck_id", deckId)
      .eq("bloom_level", prevLevel)
      .order("ended_at", { ascending: false })
      .order("score_pct", { ascending: false })
      .limit(1);
    attempts = fallback.data as AttemptRow[] | null;
    error = fallback.error;
  }

  if (error) {
    console.error("Error fetching attempts:", error);
    return NextResponse.json({ error: "failed to check attempts" }, { status: 500 });
  }

  const latestAttempt = attempts?.[0];
  const latestScore = latestAttempt ? Number(latestAttempt.score_pct ?? 0) : 0;
  if (!latestAttempt || latestScore < 60) {
    return NextResponse.json({
      success: false,
      message: "Earlier missions do not demonstrate sufficient knowledge to advance, study and return later",
      latestScore,
      attemptDate: latestAttempt?.ended_at ?? null
    });
  }

  // The latest quest mission has >=60% accuracy, so unlock the level
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
    latestScore,
    attemptDate: latestAttempt.ended_at ?? null
  });
}