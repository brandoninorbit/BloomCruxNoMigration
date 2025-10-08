import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSupabaseSession } from '@/app/supabase/session';

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const sb = supabaseAdmin();

  // Get current week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Get active weekly challenge
  const { data: challenge, error: challengeError } = await sb
    .from('weekly_challenges')
    .select('*')
    .eq('week_start', weekStart.toISOString().split('T')[0])
    .maybeSingle();

  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 500 });
  if (!challenge) return NextResponse.json({ error: 'no_active_challenge' }, { status: 404 });

  // Check if user already completed this challenge
  const { data: completion, error: completionError } = await sb
    .from('user_weekly_challenge_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challenge.id)
    .maybeSingle();

  if (completionError) return NextResponse.json({ error: completionError.message }, { status: 500 });

  return NextResponse.json({
    challenge,
    completed: !!completion,
    completion: completion || null
  });
}

export async function POST() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const sb = supabaseAdmin();

  // Get current week and challenge
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const { data: challenge, error: challengeError } = await sb
    .from('weekly_challenges')
    .select('*')
    .eq('week_start', weekStart.toISOString().split('T')[0])
    .maybeSingle();

  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 500 });
  if (!challenge) return NextResponse.json({ error: 'no_active_challenge' }, { status: 404 });

  // Check if already completed
  const { data: existingCompletion } = await sb
    .from('user_weekly_challenge_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('challenge_id', challenge.id)
    .maybeSingle();

  if (existingCompletion) return NextResponse.json({ error: 'already_completed' }, { status: 400 });

  // Award tokens
  await sb.rpc('award_tokens', {
    p_user_id: userId,
    p_tokens: challenge.tokens_reward,
    p_event_type: 'weekly_challenge',
    p_bloom_level: null,
    p_deck_id: null
  });

  // Record completion
  const { error: insertError } = await sb
    .from('user_weekly_challenge_completions')
    .insert({
      user_id: userId,
      challenge_id: challenge.id,
      tokens_awarded: challenge.tokens_reward
    });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    tokens_awarded: challenge.tokens_reward,
    challenge: challenge.objective_type
  });
}
