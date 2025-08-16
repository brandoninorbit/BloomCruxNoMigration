"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSessionContext, useUser } from "@supabase/auth-helpers-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function AuthStatus() {
  const router = useRouter();
  const { isLoading, session } = useSessionContext(); // robust loading + session
  const user = useUser();                              // User | null
  const supabase = getSupabaseBrowser();
    const [imgError, setImgError] = React.useState<boolean>(false);
    const [open, setOpen] = React.useState<boolean>(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (!open) return;
      function handleClick(e: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

  if (isLoading) return <div className="h-8 w-24" />; // tiny spacer while hydrating

  // Not signed in → show Login/Sign Up
  if (!session || !user) {
    return (
      <div className="flex items-center gap-2">
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/login")}
        >
          Login
        </button>
        <button
          className="rounded-2xl bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          onClick={() => router.push("/login")} // swap to /signup when you add it
        >
          Sign Up
        </button>
      </div>
    );
  }

  // Google avatar (no next/image → no host config needed)
  // Try multiple spots Google/Supabase put the photo
    type UserMetadata = {
      avatar_url?: string;
      picture?: string;
      [key: string]: unknown;
    };
    type IdentityData = {
      avatar_url?: string;
      picture?: string;
      [key: string]: unknown;
    };

    const meta: UserMetadata = (user?.user_metadata as UserMetadata) ?? {};
    const ident: IdentityData = Array.isArray(user?.identities) && user.identities.length > 0 && user.identities[0]?.identity_data
      ? (user.identities[0].identity_data as IdentityData)
      : {};
    const avatarUrl: string | null =
      !imgError && (meta.avatar_url || meta.picture || ident.avatar_url || ident.picture) || null;
    const initial: string = (user.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="User avatar"
          className="h-8 w-8 cursor-pointer rounded-full border object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          onClick={() => setOpen((v: boolean) => !v)}
          title={user.email ?? "Account"}
        />
      ) : (
        <div
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border text-sm"
          onClick={() => setOpen((v: boolean) => !v)}
          title={user.email ?? "Account"}
        >
          {initial}
        </div>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-32 rounded border bg-white shadow-lg">
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            onClick={async () => {
              setOpen(false);
              await supabase.auth.signOut();
              router.push("/login");
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
