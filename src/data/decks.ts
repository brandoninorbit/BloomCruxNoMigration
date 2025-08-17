import { getSupabaseClient } from '@/lib/supabase/browserClient';
import type { Deck } from '@/types';

export async function createDeck(title: string, folderId?: number | null) {
  const supabase = getSupabaseClient();
  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('decks')
    .insert([{ title, folder_id: folderId ?? null, user_id: user.id }])
    .select('id, title, description, folder_id')
    .single();

  if (error) {
    // Optional: add your own error reporting here
    throw error;
  }
  return data;
}

export async function moveDeck(deckId: number, folderId: number | null) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('decks')
    .update({ folder_id: folderId })
    .eq('id', deckId)
    .select()
    .single<Deck>();

  if (error) throw error;
  return data;
}

export async function getDecksInFolder(folderId: number) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .eq('folder_id', folderId);

  if (error) throw error;
  return data as Deck[];
}
