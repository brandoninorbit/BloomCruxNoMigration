import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

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
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // prevent redirect loop
    if (pathname !== "/login") {
      const redirect = `${pathname}${url.search}`;
      const loginUrl = new URL(`/login`, url.origin);
      loginUrl.searchParams.set("redirect", redirect);
      loginUrl.searchParams.set("reason", "no_session");
      const r = NextResponse.redirect(loginUrl);
      r.headers.set("x-bloomcrux-guard", "redirect:no_session");
      return r;
    }
  }

  res.headers.set("x-bloomcrux-guard", session ? "pass:has_session" : "pass:login");
  return res;
}

export const config = {
  matcher: ["/dashboard", "/decks/:path*", "/folders/:path*"],
};
