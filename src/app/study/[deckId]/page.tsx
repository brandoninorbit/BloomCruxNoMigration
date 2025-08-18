import { redirect } from "next/navigation";

export default async function LegacyStudyRedirect({ params }: { params: Promise<{ deckId: string }> }) {
  const resolved = await params;
  redirect(`/decks/${resolved.deckId}/study`);
}
