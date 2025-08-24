import { NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase/serverClient';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const coverId = typeof body.coverId === 'string' ? body.coverId : null;
  if (!coverId) return NextResponse.json({ error: 'coverId required' }, { status: 400 });

  const supabase = getSupabaseForRequest(req);
  const userRes = await supabase.auth.getUser();
  const uid = userRes?.data?.user?.id;
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { error } = await supabase
    .from('user_cover_purchases')
    .upsert([{ user_id: uid, cover_id: coverId, purchased_at: new Date().toISOString() }], { onConflict: 'user_id,cover_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
