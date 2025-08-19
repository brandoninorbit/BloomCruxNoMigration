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
      },
    }
  );
  await supabase.auth.getUser();
  let data: { id: number; title?: string | null } | null = null;
  try {
    const q = supabase.from("decks").select("id, title, folder_id").eq("id", id).maybeSingle();
    const { data: d } = await q;
    if (d) {
      const title = typeof (d as Record<string, unknown>).title === "string" ? String((d as Record<string, unknown>).title) : null;
      data = { id: Number((d as Record<string, unknown>).id), title };
    }
  } catch {
    // ignore and render shell
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
