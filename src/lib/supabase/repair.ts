import { getSupabaseClient } from "@/lib/supabase/browserClient";

type RepairResult =
  | { ok: true; repaired: boolean }
  | { ok: false; reason: "no-server-session" | "exception" };

function purgeLocalSupabaseTokens() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    keys.forEach((k) => {
      if (k.includes("supabase") || k.startsWith("sb-") || k.includes("bloomcrux.supabase.auth")) {
        try { localStorage.removeItem(k); } catch {}
      }
    });
  } catch {}
}

export async function repairClientSession(): Promise<RepairResult> {
  try {
    const supabase = getSupabaseClient();
    // Check current client session
    let clientSession: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      clientSession = data.session ?? null;
    } catch (e) {
      const msg = (e && typeof e === "object" && "message" in e) ? String((e as { message?: string }).message) : String(e);
      if (/Invalid Refresh Token/i.test(msg) || /Refresh Token Not Found/i.test(msg) || /Already Used/i.test(msg)) {
        // Proceed to purge and attempt server->client sync
      } else {
        return { ok: false, reason: "exception" };
      }
    }

    // If client session exists but has no refresh token, or error happened above, try syncing from server
    if (!clientSession?.refresh_token) {
      purgeLocalSupabaseTokens();
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) return { ok: false, reason: "no-server-session" };
        const body = await res.json().catch(() => ({}));
        const server = (body?.session ?? null) as { access_token?: string; refresh_token?: string } | null;
        if (server?.access_token && server?.refresh_token) {
          try {
            await supabase.auth.setSession({ access_token: server.access_token, refresh_token: server.refresh_token });
            return { ok: true, repaired: true };
          } catch {
            return { ok: false, reason: "exception" };
          }
        }
        return { ok: false, reason: "no-server-session" };
      } catch {
        return { ok: false, reason: "exception" };
      }
    }

    // Nothing to repair
    return { ok: true, repaired: false };
  } catch {
    return { ok: false, reason: "exception" };
  }
}
