import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSupabaseSession } from '@/app/supabase/session';

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function POST() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const sb = supabaseAdmin();

  // Get current streak
  const { data: streakData, error: streakError } = await sb
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (streakError) return NextResponse.json({ error: streakError.message }, { status: 500 });

  const currentStreak = streakData?.current_streak || 0;
  const threeDayClaimed = streakData?.three_day_chest_claimed || false;
  const sevenDayClaimed = streakData?.seven_day_chest_claimed || false;

  let tokensAwarded = 0;
  let chestType = '';

  if (currentStreak >= 7 && !sevenDayClaimed) {
    tokensAwarded = 75;
    chestType = 'seven_day';
    await sb
      .from('user_streaks')
      .upsert({
        user_id: userId,
        seven_day_chest_claimed: true
      }, { onConflict: 'user_id' });
  } else if (currentStreak >= 3 && !threeDayClaimed) {
    tokensAwarded = 30;
    chestType = 'three_day';
    await sb
      .from('user_streaks')
      .upsert({
        user_id: userId,
        three_day_chest_claimed: true
      }, { onConflict: 'user_id' });
  } else {
    return NextResponse.json({ error: 'no_available_chests' }, { status: 400 });
  }

  // Award tokens
  await sb.rpc('award_tokens', {
    p_user_id: userId,
    p_tokens: tokensAwarded,
    p_event_type: 'streak_chest',
    p_bloom_level: null,
    p_deck_id: null
  });

  return NextResponse.json({
    ok: true,
    tokens_awarded: tokensAwarded,
    chest_type: chestType
  });
}
