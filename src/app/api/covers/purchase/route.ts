import { NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase/serverClient';
import { COSMETIC_PRICES } from '@/lib/cosmeticPrices';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const coverId = typeof body.coverId === 'string' ? body.coverId : null;
  if (!coverId) return NextResponse.json({ error: 'coverId required' }, { status: 400 });

  const supabase = getSupabaseForRequest(req);
  const userRes = await supabase.auth.getUser();
  const uid = userRes?.data?.user?.id;
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  // Server-side price table (keep in sync with shop UI prices)
  const price = COSMETIC_PRICES[coverId];
  if (typeof price !== 'number') return NextResponse.json({ error: 'unknown coverId' }, { status: 400 });

  // Perform atomic purchase using the new RPC
  const { data: purchaseResult, error: purchaseErr } = await supabase.rpc('purchase_cosmetic', {
    p_user_id: uid,
    p_cover_id: coverId,
    p_price: price,
  });

  if (purchaseErr) return NextResponse.json({ error: purchaseErr.message }, { status: 500 });

  const result = purchaseResult as { error?: string; tokens?: number; ok?: boolean };
  if (result?.error) {
    if (result.error === 'insufficient_tokens') {
      return NextResponse.json({ error: 'insufficient_tokens', tokens: result.tokens }, { status: 402 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
