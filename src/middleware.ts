import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // In development, optionally bypass auth guard to avoid DX friction
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  // Allow login, callback, and api routes without guard
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          for (const c of cookiesToSet) {
            // NextResponse cookies API accepts name, value, and options
            res.cookies.set({ name: c.name, value: c.value, ...(c.options ?? {}) });
          }
        },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const finalized = url.searchParams.get("finalized") === "1";
    if (!finalized) {
      // First attempt: let finalize try to sync client tokens -> server cookies
      const redirect = `${pathname}${url.search}`;
      const finalizeUrl = new URL(`/auth/finalize`, url.origin);
      finalizeUrl.searchParams.set("redirect", redirect);
      const r = NextResponse.redirect(finalizeUrl);
      r.headers.set("x-bloomcrux-guard", "redirect:no_session");
      return r;
    }
    // Already finalized but still no session; send to login
    const loginUrl = new URL(`/login`, url.origin);
    loginUrl.searchParams.set("redirect", `${pathname}${url.search}`);
    loginUrl.searchParams.set("reason", "no_session_after_finalize");
    const r = NextResponse.redirect(loginUrl);
    r.headers.set("x-bloomcrux-guard", "redirect:no_session_after_finalize");
    return r;
  }

  res.headers.set("x-bloomcrux-guard", session ? "pass:has_session" : "pass:login");
  return res;
}

export const config = {
  matcher: ["/dashboard", "/decks/:path*", "/folders/:path*"],
};
