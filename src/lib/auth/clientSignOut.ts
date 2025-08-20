"use client";
import { getSupabaseClient } from "@/lib/supabase/browserClient";

/**
 * Forcefully signs the user out on both server and client, and purges any lingering local tokens.
 * Useful when refresh tokens are invalid/stale and normal signOut fails.
 */
export async function forceSignOut(redirectTo: string = "/") {
  // 1) Client-side Supabase signOut and local token purge first
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  try {
    // Remove any local/session storage entries that might keep stale sessions around
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    keys.forEach((key) => {
      if (key.includes("supabase") || key.startsWith("sb-") || key.includes("bloomcrux.supabase.auth")) {
        try { localStorage.removeItem(key); } catch {}
      }
    });
    // Clear mirrors in sessionStorage as well
    const sKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) sKeys.push(key);
    }
    sKeys.forEach((key) => {
      if (key.includes("supabase") || key.startsWith("sb-") || key.includes("bloomcrux.supabase.auth")) {
        try { sessionStorage.removeItem(key); } catch {}
      }
    });
  } catch {
    // ignore
  }

  // 2) Server-side cookie clear
  try {
    await fetch("/api/auth/signout", { method: "POST", cache: "no-store" });
  } catch {
    // ignore
  }

  // Notify UI immediately
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  } catch {}

  // Final redirect
  window.location.assign(redirectTo);
}
