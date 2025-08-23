"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/browserClient";

function FinalizeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/dashboard";
  // Use our unified client (autoRefreshToken: false) to read any existing client session
  const supabaseClient = getSupabaseClient();

  useEffect(() => {
    async function syncIfNeeded() {
      try {
        // 1) If the client already has a session, ensure server cookies are synced
        const { data: s } = await supabaseClient.auth.getSession();
        const clientSess = s.session ?? null;
        if (clientSess?.access_token && clientSess?.refresh_token) {
          try {
            await fetch("/api/auth/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access_token: clientSess.access_token, refresh_token: clientSess.refresh_token }),
            });
          } catch {}
          return; // client + server both set; proceed to redirect
        }

        // 2) Else, fetch the server session and mirror it into the client
  const res = await fetch('/api/auth/session', { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          const server = body.session as { access_token?: string; refresh_token?: string } | null;
          if (server?.access_token && server?.refresh_token) {
            try {
              await supabaseClient.auth.setSession({ access_token: server.access_token, refresh_token: server.refresh_token });
            } catch {}
          }
        }
  // Touch the session endpoint again to ensure cookies are set for subsequent SSR fetches
  try { await fetch('/api/auth/session', { cache: 'no-store' }); } catch {}
      } finally {
        // Always proceed to the target to avoid getting stuck on /auth/finalize
        const target = new URL(redirect, window.location.origin);
        target.searchParams.set("finalized", "1");
        router.replace(target.pathname + target.search);
      }
    }
    // No external loading gate needed; run once on mount
    void syncIfNeeded();
  }, [redirect, router, supabaseClient]);

  return null;
}

export default function FinalizeAuthPage() {
  return (
    <Suspense fallback={null}>
      <FinalizeContent />
    </Suspense>
  );
}
