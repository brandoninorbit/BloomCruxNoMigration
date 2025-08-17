import { getSupabaseClient } from "@/lib/supabase/browserClient";

export async function listFolders(uid: string): Promise<{ id: number; name: string }[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("folders")
    .select("id, name")
    .eq("user_id", uid)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((f) => ({ id: Number(f.id), name: String(f.name) }));
}

export async function createFolder(uid: string, name: string): Promise<{ id: number; name: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("folders")
    .insert({ user_id: uid, name })
    .select("id, name")
    .single();
  if (error) throw error;
  return { id: Number(data!.id), name: String(data!.name) };
}
