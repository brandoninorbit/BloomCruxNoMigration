import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Session } from "@supabase/supabase-js";

export async function getSupabaseSession(): Promise<Session | null> {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ?? null;
}
