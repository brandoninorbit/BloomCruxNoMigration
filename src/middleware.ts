import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const redirect = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    return NextResponse.redirect(
      new URL(`/login?redirect=${encodeURIComponent(redirect)}`, req.nextUrl.origin)
    );
  }

  return res;
}

export const config = {
  matcher: ["/dashboard", "/decks/:path*", "/folders/:path*"],
};
