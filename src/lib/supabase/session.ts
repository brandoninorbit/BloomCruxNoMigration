import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

export async function getSupabaseSession(): Promise<Session | null> {
  type CookieAdapter = { get: (name: string) => { value: string } | undefined; set: (name: string, value: string, options?: Record<string, unknown>) => void };
  const jar = cookies() as unknown as CookieAdapter;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try { return jar.get(name)?.value; } catch { return undefined; }
        },
        set(name: string, value: string, options?: Record<string, unknown>) {
          try { jar.set(name, value, options); } catch {}
        },
        remove(name: string, options?: Record<string, unknown>) {
          try { jar.set(name, '', { ...(options || {}), maxAge: 0 }); } catch {}
        },
      },
      auth: { autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  return session ?? null;
}
