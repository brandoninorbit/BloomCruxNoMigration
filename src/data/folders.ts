import { getSupabaseClient } from '@/lib/supabase/browserClient';
import type { Folder, FolderWithCount } from '@/types';

export async function createFolder(name: string, color: string) {
  const supabase = getSupabaseClient();
  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) throw new Error('Not signed in');

  const row = { name, color, user_id: user.id };
  const { data, error } = await supabase
    .from('folders')
    .insert([row])
    .select()
    .single<Folder>();

  if (error) throw error;
  return data;
}

export async function listFoldersWithCounts() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('folder_with_counts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as FolderWithCount[];
}
