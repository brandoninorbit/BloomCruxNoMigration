import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { recomputeBloomMasteryForDeck } from "@/server/mastery/recompute";

// Force Node.js runtime for server-side operations (required for service role key)
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Optional payload allows passing explicit byBloom deltas; if absent, we compute fresh counts.
  const body = await req.json().catch(() => ({}));
  const byBloomDelta = (body?.byBloomDelta ?? null) as Partial<Record<DeckBloomLevel, number>> | null;

  const sb = supabaseAdmin();

  // Count current cards by Bloom
  const { data: cardRows, error: cardsErr } = await sb
    .from("cards")
    .select("bloom_level")
    .eq("deck_id", deckId);
  if (cardsErr) return NextResponse.json({ error: cardsErr.message }, { status: 500 });
  const totals: Record<DeckBloomLevel, number> = { Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0 };
  for (const r of (cardRows ?? []) as Array<{ bloom_level: DeckBloomLevel | null }>) {
    const lvl = (r.bloom_level ?? "Remember") as DeckBloomLevel;
    totals[lvl] = (totals[lvl] ?? 0) + 1;
  }

  // Load user's existing per_bloom
  const { data: existingRow } = await sb
    .from("user_deck_quest_progress")
    .select("id, per_bloom, xp")
    .eq("user_id", session.user.id)
    .eq("deck_id", deckId)
    .maybeSingle();

  type PB = Partial<{
    totalCards: number;
    totalMissions: number;
    completedCards: number;
    missionsCompleted: number;
    masteryPercent: number;
    mastered: boolean;
    accuracySum: number;
    accuracyCount: number;
    recentAttempts: Array<{ percent: number; at: string }>;
    weightedAvg: number;
    cleared: boolean;
    // New fields per spec
    cardCount: number;
    updatedSinceLastRun: number;
    lastCompletion: { percent: number; timestamp: string; attempts: number } | null;
    missionUnlocked: boolean;
    contentVersion: number;
  }>;
  const per = ((existingRow?.per_bloom ?? {}) as unknown as Record<DeckBloomLevel, PB>) || {} as Record<DeckBloomLevel, PB>;
  const cap = DEFAULT_QUEST_SETTINGS.missionCap;

  const updated: Record<DeckBloomLevel, PB> = { ...per } as Record<DeckBloomLevel, PB>;
  for (const lvl of BLOOM_LEVELS as DeckBloomLevel[]) {
    const cur = (per[lvl] ?? {}) as PB;
    const prevCount = Number(cur.cardCount ?? cur.totalCards ?? 0);
    const nextCount = totals[lvl] ?? 0;
    const delta = nextCount - prevCount;
    const nextUpdated = Math.max(0, Number(cur.updatedSinceLastRun ?? 0) + Math.max(0, delta));
    updated[lvl] = {
      ...cur,
      cardCount: nextCount,
      totalCards: nextCount, // keep legacy field in sync
      totalMissions: Math.ceil(nextCount / cap) || 0,
      updatedSinceLastRun: nextUpdated,
      missionUnlocked: Boolean(cur.missionUnlocked ?? cur.cleared ?? false),
      contentVersion: Number(cur.contentVersion ?? 0) + (delta !== 0 ? 1 : 0),
    };
  }

  // Persist per_bloom update
  const { error: upErr } = await sb
    .from("user_deck_quest_progress")
    .upsert({ user_id: session.user.id, deck_id: deckId, per_bloom: updated, xp: existingRow?.xp ?? {} }, { onConflict: "user_id,deck_id" });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Recompute mastery aggregates for all levels asynchronously (best-effort)
  try {
    await recomputeBloomMasteryForDeck({ userId: session.user.id, deckId });
  } catch {}

  // Response includes per-level deltas for UI toast convenience
  return NextResponse.json({ ok: true, totals, delta: byBloomDelta ?? null });
}
