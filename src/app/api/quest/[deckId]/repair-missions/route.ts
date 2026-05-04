/**
 * POST /api/quest/[deckId]/repair-missions
 *
 * One-time repair endpoint.  For each Bloom level it:
 *  1. Fetches all quest attempts (oldest-first) from user_deck_mission_attempts.
 *  2. Back-fills mission_index on rows that are NULL (chronological order).
 *  3. Re-computes missionsPassed via strict consecutive-pass logic (≥60 %).
 *  4. Stores a readable missionStatus string ("3/5") inside per_bloom.
 *  5. Upserts corrected per_bloom back to user_deck_quest_progress.
 *
 * Idempotent — safe to call multiple times.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";
import type { DeckBloomLevel } from "@/types/deck-cards";

export const runtime = "nodejs";

interface AttemptRow {
  id: number;
  bloom_level: DeckBloomLevel;
  score_pct: number;
  ended_at: string;
  mission_index: number | null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) {
    return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  }

  const session = await getSupabaseSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const sb = supabaseAdmin();

  // --- 1. Load current per_bloom and card counts ---
  const [{ data: progressRow }, { data: cardRows }] = await Promise.all([
    sb
      .from("user_deck_quest_progress")
      .select("id, per_bloom, xp")
      .eq("user_id", userId)
      .eq("deck_id", deckId)
      .maybeSingle(),
    sb.from("cards").select("bloom_level").eq("deck_id", deckId),
  ]);

  const per = ((progressRow?.per_bloom ?? {}) as Record<string, Record<string, unknown>>);
  const cap = DEFAULT_QUEST_SETTINGS.missionCap;

  // Build card-count map per bloom
  const cardCountMap: Record<string, number> = {};
  for (const c of (cardRows ?? []) as Array<{ bloom_level: string | null }>) {
    const lvl = c.bloom_level ?? "Remember";
    cardCountMap[lvl] = (cardCountMap[lvl] ?? 0) + 1;
  }

  // --- 2. Fetch all quest attempts for this user+deck, oldest first ---
  const { data: rawAttempts, error: attemptsErr } = await sb
    .from("user_deck_mission_attempts")
    .select("id, bloom_level, score_pct, ended_at, mission_index")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("mode", "quest")
    .order("ended_at", { ascending: true });

  if (attemptsErr) {
    return NextResponse.json(
      { error: "failed to load attempts", detail: attemptsErr.message },
      { status: 500 }
    );
  }

  const attempts = (rawAttempts ?? []) as AttemptRow[];

  // Group by bloom level
  const byBloom: Record<DeckBloomLevel, AttemptRow[]> = {
    Remember: [], Understand: [], Apply: [], Analyze: [], Evaluate: [], Create: [],
  };
  for (const a of attempts) {
    if (byBloom[a.bloom_level]) byBloom[a.bloom_level].push(a);
  }

  const summary: Record<string, string> = {};
  const backfillUpdates: Array<{ id: number; mission_index: number }> = [];

  // --- 3. Per-bloom: assign mission_index + compute missionsPassed ---
  for (const lvl of BLOOM_LEVELS as DeckBloomLevel[]) {
    const levelAttempts = byBloom[lvl];
    const totalCards = cardCountMap[lvl] ?? 0;
    const totalMissions = Math.ceil(totalCards / cap) || 0;

    // Assign mission_index to rows that don't have one (chronological = 0,1,2,...)
    let missionsPassed = 0;
    for (let i = 0; i < levelAttempts.length; i++) {
      const attempt = levelAttempts[i]!;
      const assignedIndex = attempt.mission_index ?? i;

      // Queue a backfill update if mission_index was NULL
      if (attempt.mission_index === null || attempt.mission_index === undefined) {
        backfillUpdates.push({ id: attempt.id, mission_index: i });
        attempt.mission_index = i; // mutate locally for the pass calculation below
      }

      // Strict consecutive unlock: index must equal current missionsPassed count
      if (assignedIndex === missionsPassed && attempt.score_pct >= 60) {
        missionsPassed += 1;
      }
    }

    const missionStatus = `${missionsPassed}/${totalMissions}`;
    summary[lvl] = missionStatus;

    // Update per_bloom entry
    const cur = per[lvl] ?? {};
    const allPassed = totalMissions > 0 && missionsPassed >= totalMissions;
    per[lvl] = {
      ...cur,
      totalCards,
      totalMissions,
      missionsPassed,
      missionStatus,         // human-readable "3/5" used by debug/UI
      cleared: allPassed ? true : Boolean(cur.cleared),
    };
  }

  // --- 4. Back-fill NULL mission_index rows in the DB ---
  // Run sequentially to avoid rate limits; these are typically rare old rows
  for (const upd of backfillUpdates) {
    await sb
      .from("user_deck_mission_attempts")
      .update({ mission_index: upd.mission_index })
      .eq("id", upd.id)
      .eq("user_id", userId); // belt-and-suspenders RLS guard
  }

  // --- 5. Upsert corrected per_bloom ---
  const { error: upsertErr } = await sb
    .from("user_deck_quest_progress")
    .upsert(
      {
        user_id: userId,
        deck_id: deckId,
        per_bloom: per,
        xp: progressRow?.xp ?? {},
      },
      { onConflict: "user_id,deck_id" }
    );

  if (upsertErr) {
    return NextResponse.json(
      { error: "failed to save progress", detail: upsertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    repaired: backfillUpdates.length,
    missionStatus: summary,
    // e.g. { Remember: "3/5", Understand: "1/3", ... }
    message:
      Object.entries(summary)
        .filter(([, v]) => v !== "0/0")
        .map(([lvl, s]) => `${lvl}: mission ${s} passed in sequence`)
        .join(", ") || "No quest attempts found for this deck",
  });
}
