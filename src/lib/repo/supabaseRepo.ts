import type { Deck, Folder } from "@/types";
import { getSupabaseClient } from "@/lib/supabase/browserClient";

// Supabase-backed implementation of the DecksRepo facade used by hooks and pages.
// Note: We rely on RLS to enforce user access, but we also filter by user_id for safety.

type CreateDeckInput = { title: string; description?: string; folder_id?: number | null };

export const supabaseRepo = {
  async getDeck(deckId: string): Promise<Deck | null> {
  const supabase = getSupabaseClient();
    const id = Number(deckId);
    if (!Number.isFinite(id)) return null;

    // Rely on RLS to scope rows to the current session; avoid auth.getUser() on client
    const { data, error } = await supabase
      .from("decks")
      .select("id, title, description, folder_id, user_id, created_at, cover")
      .eq("id", id)
      .maybeSingle();

    if (error) return null;

    // Map to Deck type (cards/sources not persisted here)
    const deck: Deck = {
      id: (data?.id as number) ?? id,
      title: (data?.title as string) ?? "",
      description: (data?.description as string) ?? "",
      folder_id: (data?.folder_id as number | null) ?? null,
      user_id: (data?.user_id as string) ?? "",
      created_at: (data?.created_at as string) ?? "",
      cover: (data?.cover as string | null) ?? null,
  updatedAt: undefined,
      // sources/cards may exist in DB in the future; default to empty for UI safety
      sources: [],
      cards: [],
    };
    return deck;
  },

  async updateDeck(deck: Deck): Promise<void> {
  const supabase = getSupabaseClient();
    if (!deck?.id) return;

    // Only update known columns on the decks table
    const patch: Record<string, unknown> = {
      title: deck.title ?? "",
      description: deck.description ?? null,
      folder_id: deck.folder_id ?? null,
      cover: deck.cover ?? null,
    };

    const { error } = await supabase
      .from("decks")
      .update(patch)
      .eq("id", deck.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
  },

  async createDeck(userId: string, input: CreateDeckInput): Promise<{ id: number; title: string; description: string; folder_id: number | null }> {
  const supabase = getSupabaseClient();
    const row = {
      title: input.title,
      description: input.description ?? "",
      folder_id: input.folder_id ?? null,
      user_id: userId,
    };

    const { data, error } = await supabase
      .from("decks")
      .insert([row])
      .select("id, title, description, folder_id, cover")
      .single();

    if (error) throw error;
  return data as { id: number; title: string; description: string; folder_id: number | null; cover?: string | null };
  },

  async listRecentDecks(): Promise<Deck[]> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return [];

    const { data, error } = await supabase
      .from("decks")
      .select("id, title, description, folder_id, user_id, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((d) => ({
      id: d.id as number,
      title: (d.title as string) ?? "",
      description: (d.description as string) ?? "",
      folder_id: (d.folder_id as number | null) ?? null,
      user_id: d.user_id as string,
      created_at: d.created_at as string,
  updatedAt: undefined,
      sources: [],
      cards: [],
    }));
  },

  async listFolders(): Promise<Folder[]> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return [];

    const { data, error } = await supabase
      .from("folders")
      .select("id, name, color, user_id, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((f) => ({
      id: f.id as number,
      name: (f.name as string) ?? "",
      color: (f.color as string | null) ?? null,
      user_id: f.user_id as string,
      created_at: f.created_at as string,
  updatedAt: undefined,
      deckIds: [],
    }));
  },

  async createFolder(name: string): Promise<Folder> {
  const supabase = getSupabaseClient();
  const { data: userData, error: uerr } = await supabase.auth.getUser();
    if (uerr || !userData?.user) throw new Error("Not signed in");
    const uid = userData.user.id;

    const { data, error } = await supabase
      .from("folders")
      .insert([{ name, user_id: uid }])
      .select("id, name, color, user_id, created_at")
      .single();

    if (error) throw error;
    return {
      id: data.id as number,
      name: (data.name as string) ?? "",
      color: (data.color as string | null) ?? null,
      user_id: data.user_id as string,
      created_at: data.created_at as string,
  updatedAt: undefined,
      deckIds: [],
    } satisfies Folder;
  },

  // Check whether current user has purchased a specific cover
  async hasPurchasedCover(coverId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return false;

    const { data, error } = await supabase
      .from("user_cover_purchases")
      .select("user_id")
      .eq("user_id", uid)
      .eq("cover_id", coverId)
      .limit(1)
      .maybeSingle();

    if (error) return false;
    return !!data;
  },

  // Record a purchase for the current user (idempotent)
  async purchaseCover(coverId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: userData, error: uerr } = await supabase.auth.getUser();
    if (uerr || !userData?.user) throw new Error("Not signed in");
    const uid = userData.user.id;

    // Upsert the purchase row
    const { error } = await supabase
      .from("user_cover_purchases")
      .upsert([{ user_id: uid, cover_id: coverId, purchased_at: new Date().toISOString() }], { onConflict: "user_id,cover_id" });

    if (error) throw error;
  },

  // Get or null the user's default cover from user_settings
  async getUserDefaultCover(): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return null;

    const { data, error } = await supabase
      .from("user_settings")
      .select("default_cover")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) return null;
    return (data?.default_cover as string | null) ?? null;
  },

  // Set the user's default cover in user_settings (insert or update)
  async setUserDefaultCover(coverId: string | null): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: userData, error: uerr } = await supabase.auth.getUser();
    if (uerr || !userData?.user) throw new Error("Not signed in");
    const uid = userData.user.id;

    const payload = { user_id: uid, default_cover: coverId };
    const { error } = await supabase
      .from("user_settings")
      .upsert([payload], { onConflict: "user_id" });

    if (error) throw error;
  },
};
