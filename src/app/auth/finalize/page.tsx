"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";

function FinalizeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/dashboard";
  const { session, isLoading, supabaseClient } = useSessionContext();

  useEffect(() => {
    async function syncIfNeeded() {
      // If the client doesn't have a session yet, try to fetch it
      const { data: s } = await supabaseClient.auth.getSession();
      const curr = s.session ?? session ?? null;
      if (curr?.access_token && curr?.refresh_token) {
        try {
          await fetch("/api/auth/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: curr.access_token, refresh_token: curr.refresh_token }),
          });
        } catch {}
      }
      router.replace(redirect);
    }
    if (!isLoading) syncIfNeeded();
  }, [isLoading, redirect, router, session, supabaseClient]);

  return null;
}

export default function FinalizeAuthPage() {
  return (
    <Suspense fallback={null}>
      <FinalizeContent />
    </Suspense>
  );
}
