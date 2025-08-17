"use client";
import { useUser } from "@supabase/auth-helpers-react";
import LoginButtons from "@/components/auth/LoginButtons";
import AvatarMenu from "@/components/auth/AvatarMenu";

export default function AuthStatus() {
  const user = useUser(); // relies on the single SessionContextProvider in layout

  // Show login/signup when logged out
  if (!user) return <LoginButtons />;

  // Show avatar/account menu when logged in
  return <AvatarMenu />;
}
