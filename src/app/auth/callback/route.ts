import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirect = url.searchParams.get("redirect") || "/"; // unified home redirect

  if (code) {
    // Prepare the redirect response first so we can attach Set-Cookie to it
    const next = new URL("/auth/finalize", url.origin);
    next.searchParams.set("redirect", redirect);
    const response = NextResponse.redirect(next);

    const store = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return store.getAll().map(c => ({ name: c.name, value: c.value })); },
          setAll(cookiesToSet) {
            for (const c of cookiesToSet) {
              const dev = process.env.NODE_ENV !== 'production';
              const opts = { ...(c.options ?? {}), secure: !dev };
              response.cookies.set({ name: c.name, value: c.value, ...opts });
            }
          },
        },
        auth: { autoRefreshToken: false, detectSessionInUrl: false },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
    return response;
  }

  // If no code, just go to login
  const fallback = new URL("/login", url.origin);
  fallback.searchParams.set("redirect", redirect);
  return NextResponse.redirect(fallback);
}
