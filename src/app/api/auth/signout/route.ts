import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Normalize to the shape Supabase expects
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          for (const c of cookiesToSet) {
            cookieStore.set({ name: c.name, value: c.value, ...(c.options ?? {}) });
          }
        },
      },
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
