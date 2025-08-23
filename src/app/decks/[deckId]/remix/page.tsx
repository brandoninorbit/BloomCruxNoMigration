import RemixClient from "./RemixClient";

export const dynamic = "force-dynamic";

export default async function RemixSessionPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const id = Number(deckId);
  return <RemixClient deckId={id} />;
}
