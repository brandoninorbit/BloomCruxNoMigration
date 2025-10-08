import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSession } from '@/app/supabase/session';
import { supabaseAdmin } from '@/lib/supabase/server';

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('user_settings')
      .select('custom_avatar_url')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching custom avatar:', error);
      return NextResponse.json({ error: 'Failed to fetch avatar' }, { status: 500 });
    }

    return NextResponse.json({ custom_avatar_url: data?.custom_avatar_url || null });
  } catch (error) {
    console.error('Error in GET /api/profile/avatar:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { custom_avatar_url } = await request.json();

    const sb = supabaseAdmin();
    const { error } = await sb
      .from('user_settings')
      .upsert(
        { user_id: session.user.id, custom_avatar_url },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error updating custom avatar:', error);
      return NextResponse.json({ error: 'Failed to update avatar' }, { status: 500 });
    }

    return NextResponse.json({ success: true, custom_avatar_url });
  } catch (error) {
    console.error('Error in POST /api/profile/avatar:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = supabaseAdmin();
    const { error } = await sb
      .from('user_settings')
      .update({ custom_avatar_url: null })
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error deleting custom avatar:', error);
      return NextResponse.json({ error: 'Failed to delete avatar' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/profile/avatar:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
