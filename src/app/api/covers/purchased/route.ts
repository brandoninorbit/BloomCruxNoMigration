import { NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase/serverClient';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const coverId = url.searchParams.get('coverId');
  if (!coverId) return NextResponse.json({ error: 'coverId required' }, { status: 400 });

  const supabase = getSupabaseForRequest(req);
  const userRes = await supabase.auth.getUser();
  const uid = userRes?.data?.user?.id;
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_cover_purchases')
    .select('id')
    .eq('user_id', uid)
    .eq('cover_id', coverId)
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ purchased: !!data });
}
