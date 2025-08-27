import { NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase/serverClient';

export async function POST(req: Request) {
  // Safety: disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Dev reset disabled in production' }, { status: 403 });
  }

  const supabase = getSupabaseForRequest(req);
  const userRes = await supabase.auth.getUser();
  const uid = userRes?.data?.user?.id;
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const raw: unknown = await req.json().catch(() => ({}));
  let coverId: string | null = null;
  if (raw && typeof raw === 'object' && 'coverId' in raw) {
    const v = (raw as Record<string, unknown>).coverId;
    coverId = typeof v === 'string' ? v : null;
  }
  if (!coverId) return NextResponse.json({ error: 'coverId required' }, { status: 400 });

  // Delete purchase record
  const { error: delErr } = await supabase
    .from('user_cover_purchases')
    .delete()
    .eq('user_id', uid)
    .eq('cover_id', coverId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // Clear default_cover if it matches
  const { data: settings, error: selErr } = await supabase
    .from('user_settings')
    .select('default_cover')
    .eq('user_id', uid)
    .maybeSingle();
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  if (settings?.default_cover === coverId) {
    const { error: upErr } = await supabase
      .from('user_settings')
      .upsert([{ user_id: uid, default_cover: null }], { onConflict: 'user_id' });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
