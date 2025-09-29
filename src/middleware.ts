import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname } = url;

  // Always allow public/unprotected paths (root '/' is public marketing page)
  const PUBLIC_PREFIXES = [
    "/about",
    "/login",
    "/auth/", // includes callback + finalize
    "/api/",   // API routes manage their own auth / RLS
    "/_next/",
    "/favicon",
    "/assets/",
    "/public/",
  ];
  const isPublic = PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p));

  // If visiting root and logged out, we want to send to /about (marketing / landing)
  // So treat root as protected in that sense.

  const res = NextResponse.next();
  let session = null as unknown as { user?: unknown } | null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll().map(c => ({ name: c.name, value: c.value })); },
          setAll(cookiesToSet) {
            for (const c of cookiesToSet) {
              const dev = process.env.NODE_ENV !== 'production';
              const opts = { ...(c.options ?? {}), secure: !dev };
              res.cookies.set({ name: c.name, value: c.value, ...opts });
            }
          },
        },
        auth: { autoRefreshToken: false, detectSessionInUrl: false },
      }
    );
    const { data } = await supabase.auth.getSession();
    session = data.session;
  } catch {
    // swallow, will treat as no session
  }

  const hasSession = !!session?.user;

  if (!hasSession) {
    // Fallback: if auth cookies are present, allow pass-through so client can hydrate session.
    const hasAuthCookies = req.cookies.getAll().some(c => /sb[-_].*token/i.test(c.name));
    if (hasAuthCookies) {
      res.headers.set('x-bloomcrux-guard', 'pass:cookie-present-no-session');
      return res;
    }
    // Allow explicit public pages even when logged out
    if (isPublic || pathname === '/') return res; // root is public
    // Root or protected -> redirect to /about with redirect hint
    const about = new URL('/about', url.origin);
    // Preserve original for post-login redirect (only if not root already)
    if (pathname !== '/' && pathname !== '/about') {
      about.searchParams.set('redirect', `${pathname}${url.search}`);
    }
    const r = NextResponse.redirect(about);
    r.headers.set('x-bloomcrux-guard', 'redirect:to_about');
    return r;
  }

  // Authenticated users can freely view /about now (no redirect)

  res.headers.set('x-bloomcrux-guard', 'pass:has_session');
  return res;
}

export const config = {
  matcher: ["/dashboard", "/decks/:path*", "/folders/:path*"],
};
