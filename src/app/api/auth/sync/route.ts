import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: Request) {
  const { access_token, refresh_token } = await req
    .json()
    .catch(() => ({ access_token: null, refresh_token: null }));
  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: "missing_tokens" }, { status: 400 });
  }
  // Pass the cookies function reference directly – no synchronous access
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.setSession({ access_token, refresh_token });
  return NextResponse.json({ ok: true });
}
