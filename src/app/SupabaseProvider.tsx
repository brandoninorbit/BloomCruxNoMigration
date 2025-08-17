"use client";
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { getSupabaseClient } from '@/lib/supabase/browserClient';

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseClient();
  return <SessionContextProvider supabaseClient={supabase}>{children}</SessionContextProvider>;
}
