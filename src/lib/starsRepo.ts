import { getSupabaseClient } from "@/lib/supabase/browserClient";

export async function listStarredIds(deckId: number): Promise<number[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_starred_cards")
    .select("card_id")
    .eq("deck_id", deckId);
  if (error) return [];
  const rows = (data ?? []) as Array<{ card_id: number | string | null }>;
  return rows
    .map((r) => Number(r.card_id))
    .filter((n) => Number.isFinite(n));
}

export async function setStar(cardId: number, deckId: number, starred: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  if (starred) {
    // Need user_id to satisfy RLS and composite PK (user_id, deck_id, card_id)
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);
    const user = userRes?.user;
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
      .from("user_starred_cards")
      .upsert({ user_id: user.id, deck_id: deckId, card_id: cardId }, { onConflict: "user_id,deck_id,card_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("user_starred_cards")
      .delete()
      .eq("deck_id", deckId)
      .eq("card_id", cardId);
    if (error) throw new Error(error.message);
  }
}
