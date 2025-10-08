import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mergeCardStats } from './mergeCardStats';

// Aggregated per-card performance stats API (Reintroduced 2025-10-07)
// Returns merged SRS + mission-derived correctness metrics.
// NOTE: This route intentionally exposes read-only aggregated data to power mastery & analytics UIs.
// If you change column selections or shape, ALSO update any client components consuming this endpoint.
// Response shape (array): [{ cardId, attempts, correct, streak, ease, intervalDays, dueAt, bestCorrectness, avgCorrectness, lastAnsweredAt }]
// All correctness values are in 0..1.
export const dynamic = "force-dynamic"; // always fresh

export async function GET(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const deckIdNum = Number(deckId);
  if (!Number.isFinite(deckIdNum)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  // Fetch baseline per-card SRS-style counters
  const [statsRes, answersAggRes] = await Promise.all([
    sb
      .from("user_card_stats")
      .select("card_id, attempts, correct, streak, ease, interval_days, due_at")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckIdNum),
    sb
      .from("user_deck_mission_card_answers")
      .select("card_id, correct_fraction, answered_at")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckIdNum),
  ]);

  if (statsRes.error) return NextResponse.json({ error: statsRes.error.message }, { status: 500 });
  if (answersAggRes.error) return NextResponse.json({ error: answersAggRes.error.message }, { status: 500 });

  const merged = mergeCardStats(
    (statsRes.data ?? []) as Array<{ card_id: number; attempts: number; correct: number; streak: number; ease: number; interval_days: number; due_at: string | null }>,
    (answersAggRes.data ?? []) as Array<{ card_id: number; correct_fraction: number | null; answered_at: string | null }>
  );
  return NextResponse.json({ stats: merged });
}

// Keep legacy POST route returning 410 so older clients do not misinterpret.
export async function POST() {
  return NextResponse.json({ error: "use GET for card stats" }, { status: 410 });
}

// Pure aggregation helper exported for unit testing
// mergeCardStats now imported from separate module for clarity
