import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

export async function getSupabaseSession(): Promise<Session | null> {
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
            const opts = { ...(c.options ?? {}), secure: !dev } as Record<string, unknown>;
            store.set({ name: c.name, value: c.value, ...opts });
          }
        },
      },
      auth: { autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  return session ?? null;
}
