import { getSupabaseClient } from '@/lib/supabase/browserClient';

export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token ?? null;
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Fetch wrapper that attaches authentication for internal API calls.
 * - Client-side: adds Authorization: Bearer <access_token> when available.
 * - Server-side (Next.js server components): forwards incoming cookies so
 *   server-to-server fetches include the Supabase session cookie and
 *   API routes using `getSupabaseSession()` will be able to read the session.
 */
export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  // If running on the server (SSR / server components), forward cookies.
  if (typeof window === 'undefined') {
    try {
      // Import next/headers at runtime so this file still imports cleanly in the browser
      const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  // Build cookie header string from cookieStore
  const cookieHeader = cookieStore.getAll().map(({ name, value }: { name: string; value: string }) => `${name}=${value}`).join('; ');
      const headers = new Headers(init.headers || {});
      if (cookieHeader) headers.set('cookie', cookieHeader);
      return fetch(input, { ...init, headers });
    } catch {
      // If anything goes wrong, fall back to plain fetch
      return fetch(input, init);
    }
  }

  // Client-side: prefer access token (keeps behavior consistent with earlier impl)
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // Ensure same-origin credentials are included for cookie-backed flows
  const opts = { ...init, headers } as RequestInit & { credentials?: RequestCredentials };
  if (!opts.credentials) opts.credentials = 'same-origin';
  return fetch(input, opts);
}
