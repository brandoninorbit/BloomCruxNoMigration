import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import TargetEnterClient from "./TargetEnterClient";

export const dynamic = "force-dynamic";

type Counts = {
  total: number;
};

export default async function TargetEnterPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const id = Number(deckId);
  if (!Number.isFinite(id)) notFound();

  const sb = supabaseAdmin();
  let counts: Counts = { total: 0 };
  try {
    const { count } = await sb
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("deck_id", id);
    counts = { total: count ?? 0 };
  } catch {}

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Target Practice</h1>
        <a href={`/decks/${id}/study`} className="text-sm text-blue-700 hover:underline">Back to Study</a>
      </div>

      <div className="mb-4 text-sm text-slate-700">
        <div className="mb-2">Deck total: <span className="font-semibold">{counts.total}</span> cards</div>
      </div>

      <div className="mb-6">
        <TargetEnterClient deckId={id} counts={counts} />
      </div>
    </main>
  );
}