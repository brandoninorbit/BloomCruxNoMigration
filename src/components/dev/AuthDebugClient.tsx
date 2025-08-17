"use client";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useState } from "react";

export default function AuthDebugClient() {
  const { session, isLoading, supabaseClient } = useSessionContext();
  const [syncStatus, setSyncStatus] = useState<string>("");

  async function handleSync() {
    setSyncStatus("syncing...");
    const { data } = await supabaseClient.auth.getSession();
    const curr = data.session ?? session ?? null;
    if (!curr?.access_token || !curr?.refresh_token) {
      setSyncStatus("no client tokens to sync");
      return;
    }
    try {
      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: curr.access_token, refresh_token: curr.refresh_token }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSyncStatus("synced");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "error";
      setSyncStatus(`sync failed: ${msg}`);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm">
        <div><span className="font-medium">Client isLoading:</span> {String(isLoading)}</div>
        <div><span className="font-medium">Client user id:</span> {session?.user?.id || "-"}</div>
        <div><span className="font-medium">Client email:</span> {session?.user?.email || "-"}</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleSync} className="rounded-md border px-3 py-1.5 text-sm">Sync server cookies</button>
        <span className="text-xs text-muted-foreground">{syncStatus}</span>
      </div>
      <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-64">{JSON.stringify(session, null, 2)}</pre>
    </div>
  );
}
