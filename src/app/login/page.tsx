"use client";
import { Suspense, useEffect } from "react";


import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import EmailAuthForm from "@/components/auth/EmailAuthForm";

function GoogleLoginButton() {
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/dashboard";
  const handleGoogleLogin = async () => {
  const qs = new URLSearchParams({ redirect }).toString();
  window.location.assign(`/api/auth/signin/google?${qs}`);
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
  const { user } = useAuth();
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
  <div className="my-4 h-px bg-gray-200" />
  <h2 className="text-sm font-semibold mb-2 text-gray-800">Or sign in with email</h2>
  <EmailAuthForm />
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
