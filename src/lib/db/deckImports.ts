import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

const TABLE = 'deck_imports' as const;

export type DeckImportRow = Database['public']['Tables']['deck_imports']['Row'];
export type DeckImportInsert = Database['public']['Tables']['deck_imports']['Insert'];

export async function listDeckImports(deckId: number) {
  const supabase = createClientComponentClient<Database>();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw userErr ?? new Error('Not authenticated');

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeckImportRow[];
}

export async function upsertDeckImport(params: { deckId: number; fileHash: string; source?: string }) {
  const supabase = createClientComponentClient<Database>();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw userErr ?? new Error('Not authenticated');

  const payload: DeckImportInsert = {
    user_id: user.id,
    deck_id: params.deckId,
    file_hash: params.fileHash,
    source: params.source ?? null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'user_id,deck_id,file_hash' })
    .select()
    .single();
  if (error) throw error;
  return data as DeckImportRow;
}
