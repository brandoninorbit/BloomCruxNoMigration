"use client";
import { useRouter } from "next/navigation";

export default function LoginButtons() {
  const router = useRouter();
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
        onClick={() => router.push("/login")}
      >
        Sign Up
      </button>
    </div>
  );
}
