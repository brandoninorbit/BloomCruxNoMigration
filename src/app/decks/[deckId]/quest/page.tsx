import { Suspense } from "react";
import QuestClient from "./questClient";

export default async function QuestPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const id = Number(deckId);
  return (
    <Suspense>
      <QuestClient deckId={id} />
    </Suspense>
  );
}
