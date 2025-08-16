"use client";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowser();
  return <SessionContextProvider supabaseClient={supabase}>{children}</SessionContextProvider>;
}
