import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Provider } from "@supabase/supabase-js";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const redirect = url.searchParams.get("redirect") || "/dashboard";
  const origin = url.origin;

  // Collect cookies to set on the eventual redirect response
  const jar: Array<{ name: string; value: string; options?: Partial<import('cookie').CookieSerializeOptions> }> = [];
  const store = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          for (const c of cookiesToSet) {
            const dev = process.env.NODE_ENV !== "production";
            const opts = { ...(c.options ?? {}), secure: !dev };
            jar.push({ name: c.name, value: c.value, options: opts });
          }
        },
      },
      auth: { autoRefreshToken: false, detectSessionInUrl: false },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
    },
  });

  if (error || !data?.url) {
    // Fall back to login on failure
    const fallback = NextResponse.redirect(new URL(`/login?reason=oauth_start_failed`, origin));
    for (const c of jar) fallback.cookies.set({ name: c.name, value: c.value, ...(c.options ?? {}) });
    return fallback;
  }

  const res = NextResponse.redirect(data.url);
  for (const c of jar) res.cookies.set({ name: c.name, value: c.value, ...(c.options ?? {}) });
  return res;
}
