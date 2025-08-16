"use client";
import { Suspense } from "react";

import { useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

function GoogleLoginButton() {
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/dashboard";
  const supabase = getSupabaseBrowser();
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
  };
  return (
    <button
      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      onClick={handleGoogleLogin}
    >
      Continue with Google
    </button>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 text-center">Sign in</h1>
        <Suspense>
          <GoogleLoginButton />
        </Suspense>
      </div>
    </div>
  );
}
