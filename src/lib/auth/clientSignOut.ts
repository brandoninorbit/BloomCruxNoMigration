"use client";
import { getSupabaseClient } from "@/lib/supabase/browserClient";

/**
 * Forcefully signs the user out on both server and client, and purges any lingering local tokens.
 * Useful when refresh tokens are invalid/stale and normal signOut fails.
 */
export async function forceSignOut(redirectTo: string = "/") {
  // Try server-side cookie clear first
  try {
    await fetch("/api/auth/signout", { method: "POST" });
  } catch {
    // ignore
  }

  // Client-side Supabase signOut and local token purge
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  try {
    // Remove any localStorage entries that might keep stale sessions around
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.includes("supabase") || key.startsWith("sb-") || key.includes("bloomcrux.supabase.auth")) {
        try { localStorage.removeItem(key); } catch {}
      }
    }
  } catch {
    // ignore
  }

  // Final redirect
  window.location.assign(redirectTo);
}
