import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSession } from '@/app/supabase/session';
import { recordMissionAttempt } from '@/server/progression/quest';
import type { DeckBloomLevel } from '@/types/deck-cards';

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: 'invalid deckId' }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bloom_level = body?.bloom_level as DeckBloomLevel | undefined;
  const score_pct = Number(body?.score_pct ?? NaN);
  let cards_seen = Number(body?.cards_seen ?? 0);
  let cards_correct = Number(body?.cards_correct ?? 0);
  const started_at = typeof body?.started_at === 'string' ? body.started_at : null;
  const ended_at = typeof body?.ended_at === 'string' ? body.ended_at : null;
  const mode = typeof body?.mode === 'string' ? body.mode : 'study';
  const breakdown = typeof body?.breakdown === 'object' && body.breakdown ? (body.breakdown as Record<string, { scorePct: number; cardsSeen: number; cardsCorrect: number }>) : undefined;
  const answers = Array.isArray(body?.answers) ? (body.answers as Array<{ cardId: number; correct: boolean | number }>) : undefined;

  if (!bloom_level || Number.isNaN(score_pct)) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  cards_seen = Math.max(0, Math.floor(cards_seen));
  cards_correct = Math.max(0, Math.min(cards_seen, Math.floor(cards_correct)));

  const attempt = await recordMissionAttempt({
    userId: session.user.id,
    deckId,
    bloomLevel: bloom_level,
    scorePct: score_pct,
    cardsSeen: cards_seen,
    cardsCorrect: cards_correct,
    startedAt: started_at,
    endedAt: ended_at,
    mode: mode as 'quest' | 'remix' | 'drill' | 'study' | 'starred',
    breakdown,
    answers,
  });
  if (!attempt.ok) return NextResponse.json({ error: attempt.error }, { status: 500 });
  return NextResponse.json({ success: true, attemptId: attempt.attemptId });
}
