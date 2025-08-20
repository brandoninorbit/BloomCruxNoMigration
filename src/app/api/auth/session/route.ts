import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
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
      auth: { autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return NextResponse.json({ session, user: session?.user ?? null });
}
