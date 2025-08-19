import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  const { access_token, refresh_token } = await req
    .json()
    .catch(() => ({ access_token: null, refresh_token: null }));
  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: "missing_tokens" }, { status: 400 });
  }
  // Pass a stable cookies accessor – avoids sync dynamic API usage and matches Supabase expectations
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
            store.set({ name: c.name, value: c.value, ...(c.options ?? {}) });
          }
        },
      },
    }
  );
  await supabase.auth.setSession({ access_token, refresh_token });
  return NextResponse.json({ ok: true });
}
