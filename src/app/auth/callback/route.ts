import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirect = url.searchParams.get("redirect") || "/dashboard";

  if (code) {
  const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  // After the server exchanges the code, redirect to a small client page that
  // verifies the client session and optionally posts tokens back to server if needed.
  const next = new URL("/auth/finalize", url.origin);
  next.searchParams.set("redirect", redirect);
  return NextResponse.redirect(next);
}
