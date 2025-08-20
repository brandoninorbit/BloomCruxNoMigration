"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/browserClient";
import { useAuth } from "@/app/providers/AuthProvider";

export default function SecurityPage() {
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSet = Boolean(user?.id);

  async function onSet() {
    setBusy(true); setErr(null); setMsg(null);
    if (pw.length < 6) {
      setBusy(false);
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (pw !== confirm) {
      setBusy(false);
      setErr("Passwords do not match.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(error.message || "Failed to set password"); return; }
    setMsg("Password set.");
    setPw("");
    setConfirm("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">Security</h1>
        {!canSet && (
          <div className="text-sm text-gray-600 mb-4">You need to be signed in to set a password.</div>
        )}
        <input
          type="password"
          className="w-full border rounded px-3 py-2 mb-3"
          placeholder="New password (min 6 chars)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          disabled={!canSet}
        />
        <input
          type="password"
          className="w-full border rounded px-3 py-2 mb-3"
          placeholder="Retype new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={!canSet}
        />
        <button
          className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg font-semibold hover:bg-black/90 disabled:opacity-60"
          disabled={!canSet || busy || pw.length < 6 || pw !== confirm}
          onClick={onSet}
          type="button"
        >
          {busy ? "Saving…" : "Set password"}
        </button>
        {err && <div className="text-red-600 text-sm mt-3">{err}</div>}
        {msg && <div className="text-green-700 text-sm mt-3">{msg}</div>}
        <div className="text-xs text-gray-500 mt-6">TODO: add full account settings page and link here.</div>
      </div>
    </div>
  );
}
