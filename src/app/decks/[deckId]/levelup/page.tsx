import LevelUpClient from "./LevelUpClient";

export default async function LevelUpSessionPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const id = Number(deckId);
  return <LevelUpClient deckId={id} />;
}
