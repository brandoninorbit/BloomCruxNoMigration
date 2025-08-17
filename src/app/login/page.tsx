"use client";
import { Suspense, useEffect } from "react";

import { getSupabaseClient } from "@/lib/supabase/browserClient";

import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@supabase/auth-helpers-react";

function GoogleLoginButton() {
  const supabase = getSupabaseClient();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/dashboard";
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

function LoginContent() {
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/dashboard";
  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, redirect, router]);
  return (
    <>
      <h1 className="text-2xl font-bold mb-6 text-gray-900 text-center">Sign in</h1>
      <GoogleLoginButton />
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <Suspense fallback={null}>
          <LoginContent />
        </Suspense>
      </div>
    </div>
  );
}
