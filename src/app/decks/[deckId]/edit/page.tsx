import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import EditDeckClient from "@/components/decks/EditDeckClient";
import EditDeckForm from "@/components/decks/EditDeckForm";

export const dynamic = "force-dynamic";

export default async function EditDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const resolved = await params;
  const id = Number(resolved?.deckId);
  if (!Number.isFinite(id)) {
    notFound();
  }
  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
    // No-op writer to avoid Next RSC mutation and silence ssr warning
    setAll() { /* noop in RSC */ },
      },
  auth: { autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
  // Avoid calling auth.getUser() in RSC to prevent refresh/write attempts
  let data: { id: number; title?: string | null } | null = null;
  try {
    // Rely on RLS to scope rows to the current session; no need to fetch user explicitly
    const { data: d, error } = await supabase
      .from("decks")
      .select("id, title, folder_id")
      .eq("id", id)
      .maybeSingle();
    
    if (error) {
      // Log safely without throwing to avoid dev overlay noise
      console.warn('[EditDeckPage] deck fetch error:', error.message || error);
    } else if (d) {
      const title = typeof (d as Record<string, unknown>).title === "string" ? String((d as Record<string, unknown>).title) : null;
      data = { id: Number((d as Record<string, unknown>).id), title };
    }
  } catch (e) {
    // Catch any other errors and log safely
    const msg = e && typeof e === 'object' && 'message' in e ? (e as { message: string }).message : String(e);
    console.warn('[EditDeckPage] unexpected error:', msg);
  }

  // Render the full page layout:
  // - EditDeckForm: header, title/description, actions, CSV, sources
  // - EditDeckClient: the Cards section with "Load Cards" button at the bottom
  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-4xl mx-auto">
  <EditDeckForm deckId={String(id)} />
  <EditDeckClient deckId={id} title={(data?.title as string) ?? ""} />
      </div>
    </main>
  );
}
