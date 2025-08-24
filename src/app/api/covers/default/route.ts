import { NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase/serverClient';

export async function GET(req: Request) {
  const supabase = getSupabaseForRequest(req);
  // RLS will apply based on Authorization header
  const { data, error } = await supabase.from('user_settings').select('default_cover').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ defaultCover: data?.default_cover ?? null });
}

export async function POST(req: Request) {
  const supabase = getSupabaseForRequest(req);
  const body = await req.json().catch(() => ({}));
  const coverId = typeof body.coverId === 'string' ? body.coverId : null;

  const userRes = await supabase.auth.getUser();
  const uid = userRes?.data?.user?.id;
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const payload = { user_id: uid, default_cover: coverId };
  const { error } = await supabase.from('user_settings').upsert([payload], { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
