import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirect = url.searchParams.get("redirect") || "/dashboard";

  if (code) {
    const store = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return store.getAll().map(c => ({ name: c.name, value: c.value })); },
          setAll(cookiesToSet) { for (const c of cookiesToSet) store.set({ name: c.name, value: c.value, ...(c.options ?? {}) }); },
        },
        auth: { autoRefreshToken: false, detectSessionInUrl: false },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  // After the server exchanges the code, redirect to a small client page that
  // verifies the client session and optionally posts tokens back to server if needed.
  const next = new URL("/auth/finalize", url.origin);
  next.searchParams.set("redirect", redirect);
  return NextResponse.redirect(next);
}
