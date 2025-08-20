"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/browserClient";

export default function EmailAuthForm() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp?.get("redirect") || "/decks";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSignIn() {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr(error.message || "Sign in failed"); return; }
    router.push(redirect);
  }

  async function onSignUp() {
    setBusy(true); setErr(null); setMsg(null);
    if (password.length < 6) {
      setBusy(false);
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setBusy(false);
      setErr("Passwords do not match.");
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // After email confirm/reset, we can let users set a new password or just sign in
        emailRedirectTo: `${location.origin}/login?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    setBusy(false);
    if (error) { setErr(error.message || "Sign up failed"); return; }
    setMsg("Check your email to verify your address before signing in.");
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          className={`px-2 py-1 rounded ${mode === "signin" ? "bg-gray-200" : ""}`}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`px-2 py-1 rounded ${mode === "signup" ? "bg-gray-200" : ""}`}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
      </div>

      <input
        className="w-full border rounded px-3 py-2"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full border rounded px-3 py-2"
        type="password"
        placeholder="Password (min 6 chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {mode === "signup" && (
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="Retype password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      )}

      {mode === "signin" ? (
        <button
          type="button"
          disabled={busy}
          className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg font-semibold hover:bg-black/90 disabled:opacity-60"
          onClick={onSignIn}
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || password.length < 6 || password !== confirm}
          className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg font-semibold hover:bg-black/90 disabled:opacity-60"
          onClick={onSignUp}
        >
          {busy ? "Creating account..." : "Sign up"}
        </button>
      )}

      <div className="text-xs text-gray-500">Forgot password flow coming soon.</div>

      {err && <div className="text-red-600 text-sm">{err}</div>}
      {msg && <div className="text-green-700 text-sm">{msg}</div>}
    </div>
  );
}
