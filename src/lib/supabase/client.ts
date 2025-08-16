"use client";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
// import type { Database } from "@/types/index"; // optional

let _client: ReturnType<typeof createClientComponentClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) _client = createClientComponentClient(/*<Database>*/);
  return _client;
}
