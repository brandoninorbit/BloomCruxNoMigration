import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";

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
export function mergeCardStats(
  statsRows: Array<{ card_id: number; attempts: number; correct: number; streak: number; ease: number; interval_days: number; due_at: string | null }>,
  answersRows: Array<{ card_id: number; correct_fraction: number | null; answered_at: string | null }>
) {
  function mapBase(r: { card_id: number; attempts: number; correct: number; streak: number; ease: number; interval_days: number; due_at: string | null }) {
    return {
      cardId: Number(r.card_id),
      attempts: Number(r.attempts ?? 0),
      correct: Number(r.correct ?? 0),
      streak: Number(r.streak ?? 0),
      ease: typeof r.ease === 'number' ? r.ease : 2.5,
      intervalDays: Number(r.interval_days ?? 0),
      dueAt: r.due_at ?? null,
      bestCorrectness: 0,
      avgCorrectness: 0,
      lastAnsweredAt: null as string | null,
    };
  }
  const stats = new Map<number, ReturnType<typeof mapBase>>();
  for (const r of statsRows) stats.set(Number(r.card_id), mapBase(r));
  const aggMap = new Map<number, { best: number; sum: number; count: number; last: string | null }>();
  for (const row of answersRows) {
    const cid = Number(row.card_id);
    const val = typeof row.correct_fraction === 'number' ? row.correct_fraction : 0;
    const bucket = aggMap.get(cid) || { best: 0, sum: 0, count: 0, last: null };
    if (val > bucket.best) bucket.best = val;
    bucket.sum += val;
    bucket.count += 1;
    if (!bucket.last || (row.answered_at && new Date(row.answered_at) > new Date(bucket.last))) {
      bucket.last = row.answered_at;
    }
    aggMap.set(cid, bucket);
  }
  for (const [cid, data] of aggMap.entries()) {
    const base = stats.get(cid) || mapBase({ card_id: cid, attempts: 0, correct: 0, streak: 0, ease: 2.5, interval_days: 0, due_at: null });
    base.bestCorrectness = data.best;
    base.avgCorrectness = data.count > 0 ? data.sum / data.count : 0;
    base.lastAnsweredAt = data.last;
    stats.set(cid, base);
  }
  return Array.from(stats.values()).sort((a, b) => a.cardId - b.cardId);
}
