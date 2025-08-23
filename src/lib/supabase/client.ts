
import { createClient as createBrowserClient } from '@supabase/supabase-js';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, key, {
    auth: {
      persistSession: true,
  autoRefreshToken: false,
  // Avoid client-side code exchange; server handles it
  detectSessionInUrl: false,
      storageKey: 'bloomcrux.supabase.auth',
    },
  });
}
