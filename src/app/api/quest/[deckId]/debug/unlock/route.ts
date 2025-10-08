import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSession } from '@/app/supabase/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { BLOOM_LEVELS } from '@/types/card-catalog';

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const deckIdNum = Number(deckId);
  if (!Number.isFinite(deckIdNum)) return NextResponse.json({ error: 'invalid deckId' }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const [progressRow, attemptsRes] = await Promise.all([
    sb.from('user_deck_quest_progress').select('per_bloom').eq('user_id', session.user.id).eq('deck_id', deckIdNum).maybeSingle(),
    sb.from('user_deck_mission_attempts').select('bloom_level, score_pct, mode, ended_at').eq('user_id', session.user.id).eq('deck_id', deckIdNum).order('ended_at', { ascending: false }).limit(50),
  ]);

  if (progressRow.error) return NextResponse.json({ error: progressRow.error.message }, { status: 500 });
  if (attemptsRes.error) return NextResponse.json({ error: attemptsRes.error.message }, { status: 500 });

  type PerBloomMinimal = {
    mastered?: boolean;
    cleared?: boolean;
    missionsPassed?: number;
    [k: string]: unknown;
  };
  const per = (progressRow.data?.per_bloom ?? {}) as Record<string, PerBloomMinimal>;
  type Attempt = { bloom_level: string; score_pct: number; mode?: string | null; ended_at: string };
  const attempts: Attempt[] = (attemptsRes.data ?? []).filter((a: Attempt) => a.mode === 'quest');
  const passThreshold = 65;

  const reasoning: Array<{ level: string; prev?: string; unlocked: boolean; basis: string[] }> = [];
  for (let i = 0; i < BLOOM_LEVELS.length; i++) {
    const lvl = BLOOM_LEVELS[i]!;
    if (i === 0) {
      reasoning.push({ level: lvl, unlocked: true, basis: ['first'] });
      continue;
    }
    const prev = BLOOM_LEVELS[i - 1]!;
  const prevData: PerBloomMinimal = per[prev] || {};
    const basis: string[] = [];
    let unlocked = false;
    if (prevData.mastered) { unlocked = true; basis.push('prev.mastered'); }
    if (!unlocked && prevData.cleared) { unlocked = true; basis.push('prev.cleared'); }
    const missionsPassed = Number(prevData.missionsPassed ?? 0);
    if (!unlocked && missionsPassed > 0) { unlocked = true; basis.push('prev.missionsPassed>0'); }
  const prevAttempts = attempts.filter(a => a.bloom_level === prev);
  const best = prevAttempts.reduce<Attempt | null>((m, a) => (a.score_pct > (m?.score_pct ?? -1) ? a : m), null);
    if (!unlocked && best && best.score_pct >= passThreshold) { unlocked = true; basis.push('bestAttempt>=65'); }
    reasoning.push({ level: lvl, prev, unlocked, basis });
  }

  return NextResponse.json({ deckId: deckIdNum, reasoning, per_bloom_keys: Object.keys(per), raw: per });
}
