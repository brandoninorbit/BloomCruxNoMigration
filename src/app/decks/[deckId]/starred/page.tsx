import { notFound } from "next/navigation";
import StarredClient from "./starredClient";

export default async function StarredPage({ params }: { params: Promise<{ deckId: string }> }) {
  const resolved = await params;
  const id = Number(resolved?.deckId);
  if (!Number.isFinite(id)) notFound();
  return <StarredClient deckId={id} />;
}
