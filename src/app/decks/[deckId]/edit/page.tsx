'use client';
import { useParams } from 'next/navigation';
import EditDeckForm from '@/components/decks/EditDeckForm';

export default function EditDeckPage() {
  const params = useParams<{ deckId: string }>();
  const deckId = (params?.deckId as string) ?? '';
  return <EditDeckForm deckId={deckId} />;
}
