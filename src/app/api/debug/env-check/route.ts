import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/app/supabase/session";

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSupabaseSession();
    
    // Check environment variables
    const envCheck = {
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV,
      runtime: process.env.NEXT_RUNTIME || 'nodejs',
      vercelEnv: process.env.VERCEL_ENV,
    };
    
    // Test supabaseAdmin()
    let adminClientWorks = false;
    let adminError = null;
    try {
      const sb = supabaseAdmin();
      const { error } = await sb.from('user_economy').select('tokens').limit(1);
      adminClientWorks = !error;
      adminError = error?.message || null;
    } catch (e) {
      adminError = e instanceof Error ? e.message : String(e);
    }
    
    // Test session
    const sessionInfo = {
      hasSession: !!session,
      userId: session?.user?.id || null,
    };
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: envCheck,
      adminClient: {
        works: adminClientWorks,
        error: adminError,
      },
      session: sessionInfo,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
