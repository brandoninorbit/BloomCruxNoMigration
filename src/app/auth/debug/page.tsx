"use client";
import { Suspense, useEffect, useState } from "react";
import AuthDebugClient from "@/components/dev/AuthDebugClient";

export default function AuthDebugPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Auth Debug</h1>
      <p className="text-sm text-muted-foreground">Quick view of client session and server session.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Client</h2>
          <Suspense fallback={<div className="text-sm">Loading client state…</div>}>
            <AuthDebugClient />
          </Suspense>
        </div>
        <ServerSessionCard />
      </div>
    </div>
  );
}

type ServerSessionResponse = { session: { user?: { id?: string; email?: string } } | null; user: { id?: string; email?: string } | null } | null;

function ServerSessionCard() {
  const [json, setJson] = useState<ServerSessionResponse>(null);
  const [header, setHeader] = useState<string>("");
  useEffect(() => {
    async function load() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      setHeader(res.headers.get("x-bloomcrux-guard") || "");
      const data = await res.json().catch(() => null);
      setJson(data);
    }
    load();
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Server</h2>
      <div className="text-sm"><span className="font-medium">x-bloomcrux-guard:</span> {header || "(none)"}</div>
      <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-64">{JSON.stringify(json, null, 2)}</pre>
    </div>
  );
}
