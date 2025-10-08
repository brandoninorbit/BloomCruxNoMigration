import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/app/supabase/session";

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSupabaseSession();
  
  // Debug logging for production troubleshooting
  console.log('💰 Wallet API called:', {
    hasSession: !!session,
    userId: session?.user?.id || null,
    timestamp: new Date().toISOString(),
  });
  
  if (!session?.user?.id) {
    console.log('❌ Wallet: No session, returning 401');
    return NextResponse.json({ error: "unauthorized", debug: { session: null } }, { status: 401 });
  }
  
  const userId = session.user.id;
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("user_economy").select("tokens, commander_xp, commander_level").eq("user_id", userId).maybeSingle();
  
  if (error) {
    console.log('❌ Wallet: Database error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  const tokens = Number(data?.tokens ?? 0);
  const commander_xp = Number(data?.commander_xp ?? 0);
  const commander_level = Number(data?.commander_level ?? 1);
  
  console.log('✅ Wallet: Success', { tokens, commander_xp, commander_level });
  
  return NextResponse.json({ tokens, commander_xp, commander_level });
}
