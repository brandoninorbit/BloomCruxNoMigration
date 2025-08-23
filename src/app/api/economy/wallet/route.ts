import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/lib/supabase/session";

export async function GET() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("user_economy").select("tokens, commander_xp").eq("user_id", userId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tokens = Number(data?.tokens ?? 0);
  const commander_xp = Number(data?.commander_xp ?? 0);
  return NextResponse.json({ tokens, commander_xp });
}
