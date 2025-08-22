import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/lib/supabase/session";
import { recordMissionAttempt, unlockNextBloomLevel, updateQuestProgressOnComplete } from "@/server/progression/quest";
import { updateBloomMastery } from "@/server/mastery/updateBloomMastery";
import type { DeckBloomLevel } from "@/types/deck-cards";

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bloom_level = body?.bloom_level as DeckBloomLevel | undefined;
  const score_pct = Number(body?.score_pct ?? NaN);
  const cards_seen = Number(body?.cards_seen ?? 0);
  const cards_correct = Number(body?.cards_correct ?? 0);
  const started_at = typeof body?.started_at === "string" ? body.started_at : null;
  const ended_at = typeof body?.ended_at === "string" ? body.ended_at : null;
  if (!bloom_level || Number.isNaN(score_pct)) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  // Insert attempt
  const attempt = await recordMissionAttempt({
    userId: session.user.id,
    deckId,
  bloomLevel: bloom_level,
    scorePct: score_pct,
    cardsSeen: cards_seen,
    cardsCorrect: cards_correct,
    startedAt: started_at,
    endedAt: ended_at,
  });
  if (!attempt.ok) return NextResponse.json({ error: attempt.error }, { status: 500 });

  // Unlock next on single pass (>=65)
  if (score_pct >= 65) {
  await unlockNextBloomLevel(session.user.id, deckId, bloom_level);
  }

  // Update per_bloom aggregates for counters and averages
  try {
    await updateQuestProgressOnComplete({ userId: session.user.id, deckId, level: bloom_level, scorePct: score_pct, cardsSeen: cards_seen });
  } catch {}

  // Update mastery aggregates (EWMA + retention + coverage)
  try {
  await updateBloomMastery({ userId: session.user.id, deckId, bloomLevel: bloom_level, lastScorePct: score_pct });
  } catch {}

  return NextResponse.json({ ok: true, attemptId: attempt.attemptId, unlocked: score_pct >= 65 });
}
