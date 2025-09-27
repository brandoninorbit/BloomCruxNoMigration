import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | null = null;

// Lightweight noop placeholder used during build/SSR static prerender when public env vars
// may not be injected yet. We only instantiate the real client in the browser.
function placeholderClient() {
  return {
    auth: {
      // Shapes mimic supabase-js; return empty sessions so UI falls back to mock paths.
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null })
    },
  } as unknown as ReturnType<typeof createClient>;
}

export function getSupabaseClient() {
  if (client) return client;
  if (typeof window === 'undefined') {
    // Avoid throwing "supabaseUrl is required" during prerender of client pages.
    return placeholderClient();
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // In browser but missing env (should not happen in production); fall back to placeholder.
    return placeholderClient();
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: 'bloomcrux.supabase.auth',
      autoRefreshToken: false,
    }
  });
  return client;
}
