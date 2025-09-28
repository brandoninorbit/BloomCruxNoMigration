import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSession } from '@/app/supabase/session';
import { supabaseAdmin } from '@/lib/supabase/server';

// Returns per-card answers for a specific attempt id or the most recent quest attempt.
export async function GET(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const deckIdNum = Number(deckId);
  if (!Number.isFinite(deckIdNum)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const u = new URL(req.url);
  const attemptIdParam = u.searchParams.get('attemptId');
  let attemptId: number | null = attemptIdParam ? Number(attemptIdParam) : null;
  if (attemptIdParam && !Number.isFinite(attemptId)) return NextResponse.json({ error: 'invalid attemptId' }, { status: 400 });

  // If no attemptId, fetch latest mission attempt (quest mode preferred) for this deck/user.
  if (!attemptId) {
    const { data: latest, error: latestErr } = await sb
      .from('user_deck_mission_attempts')
      .select('id, mode, ended_at, answers_json')
      .eq('user_id', session.user.id)
      .eq('deck_id', deckIdNum)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) return NextResponse.json({ error: latestErr.message }, { status: 500 });
    if (!latest) return NextResponse.json({ found: false });
    attemptId = latest.id;
    // If answers_json already present, return quickly without detail join.
    if (latest.answers_json) {
      return NextResponse.json({ found: true, attemptId, answers: latest.answers_json });
    }
  }

  // Pull answers_json plus detail rows (detail rows guarantee data if answers_json was null earlier).
  const [{ data: attemptRow, error: aErr }, { data: detailRows, error: dErr }] = await Promise.all([
    sb
      .from('user_deck_mission_attempts')
      .select('id, answers_json')
      .eq('user_id', session.user.id)
      .eq('deck_id', deckIdNum)
      .eq('id', attemptId!)
      .maybeSingle(),
    sb
      .from('user_deck_mission_card_answers')
      .select('card_id, correct_fraction')
      .eq('attempt_id', attemptId!)
  ]);
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
  if (!attemptRow) return NextResponse.json({ found: false });

  let answers = attemptRow.answers_json as unknown;
  if ((!answers || (Array.isArray(answers) && answers.length === 0)) && Array.isArray(detailRows)) {
    answers = detailRows.map(r => ({ cardId: r.card_id, correct: r.correct_fraction }));
  }
  return NextResponse.json({ found: true, attemptId, answers });
}
