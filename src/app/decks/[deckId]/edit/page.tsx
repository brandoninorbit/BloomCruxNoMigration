import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import EditDeckClient from "@/components/decks/EditDeckClient";
import EditDeckForm from "@/components/decks/EditDeckForm";

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
  const cookiesAccessor = (async () => store) as Parameters<typeof createServerComponentClient>[0]["cookies"];
  const supabase = createServerComponentClient({ cookies: cookiesAccessor });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    notFound();
  }

  const { data, error } = await supabase
    .from("decks")
    .select("id, title, folder_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    notFound();
  }

  // Render the full page layout:
  // - EditDeckForm: header, title/description, actions, CSV, sources
  // - EditDeckClient: the Cards section with "Load Cards" button at the bottom
  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-4xl mx-auto">
        <EditDeckForm deckId={String(data.id)} />
        <EditDeckClient deckId={data.id as number} title={(data.title as string) ?? ""} />
      </div>
    </main>
  );
}
