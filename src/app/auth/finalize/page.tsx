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
        // Try to read any existing client session (persisted in localStorage)
        const { data: s } = await supabaseClient.auth.getSession();
        const curr = s.session ?? null;
        if (curr?.access_token && curr?.refresh_token) {
          try {
            await fetch("/api/auth/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access_token: curr.access_token, refresh_token: curr.refresh_token }),
            });
          } catch {
            // ignore sync errors; we'll still attempt the redirect below
          }
        }
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
