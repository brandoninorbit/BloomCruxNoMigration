import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return store.get(name)?.value; },
        set(name: string, value: string, options?: Record<string, unknown>) { store.set({ name, value, ...(options ?? {}) }); },
        remove(name: string, options?: Record<string, unknown>) { store.set({ name, value: "", ...(options ?? {}), maxAge: 0 }); },
      },
    }
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return NextResponse.json({ session, user: session?.user ?? null });
}
