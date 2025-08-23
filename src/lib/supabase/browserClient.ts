import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          // Avoid client-side code exchange; server does it in /auth/callback
          detectSessionInUrl: false,
          storageKey: 'bloomcrux.supabase.auth',
          autoRefreshToken: false, // Prevent "Already Used" refresh token errors
        }
      }
    );
  }
  return client;
}
