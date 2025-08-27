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

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // Ensure JSON defaults are preserved when content-type already set by caller
  return fetch(input, { ...init, headers });
}
