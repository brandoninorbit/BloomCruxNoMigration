import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  const store = await cookies();
  const cookiesAccessor = (async () => store) as Parameters<typeof createRouteHandlerClient>[0]["cookies"];
  const supabase = createRouteHandlerClient({ cookies: cookiesAccessor });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return NextResponse.json({ session, user: session?.user ?? null });
}
