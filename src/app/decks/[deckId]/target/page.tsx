import TargetClient from "./TargetClient";

export const dynamic = "force-dynamic";

export default async function TargetSessionPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const id = Number(deckId);
  return <TargetClient deckId={id} />;
}