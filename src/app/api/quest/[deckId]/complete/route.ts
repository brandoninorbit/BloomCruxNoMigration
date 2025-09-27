import { NextRequest, NextResponse } from "next/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { recordMissionAttempt, unlockNextBloomLevel, updateQuestProgressOnComplete } from "@/server/progression/quest";
import { updateBloomMastery } from "@/server/mastery/updateBloomMastery";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId: deckIdStr } = await params;
  const deckId = Number(deckIdStr);
  if (!Number.isFinite(deckId)) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bloom_level = body?.bloom_level as DeckBloomLevel | undefined;
  const score_pct = Number(body?.score_pct ?? NaN);
  let cards_seen = Number(body?.cards_seen ?? 0);
  let cards_correct = Number(body?.cards_correct ?? 0);
  const started_at = typeof body?.started_at === "string" ? body.started_at : null;
  const ended_at = typeof body?.ended_at === "string" ? body.ended_at : null;
  // Normalize mode case-insensitively; older clients may send capitalized values like "Quest"
  const allowedModes = ['quest','remix','drill','study','starred'] as const;
  const rawMode = typeof body?.mode === 'string' ? body.mode : undefined;
  const modeLower = rawMode ? rawMode.toLowerCase() : undefined;
  const mode = (allowedModes as readonly string[]).includes(modeLower ?? '') ? (modeLower as typeof allowedModes[number]) : undefined;
  const breakdown = typeof body?.breakdown === 'object' && body.breakdown ? (body.breakdown as Record<string, { scorePct: number; cardsSeen: number; cardsCorrect: number }>) : undefined;
  // If breakdown is provided, recompute aggregate counts for consistency and to avoid inflated values
  if (breakdown && Object.keys(breakdown).length > 0) {
    let aggSeen = 0;
    let aggCorrect = 0;
    for (const key of Object.keys(breakdown)) {
      const part = breakdown[key]!;
      const seen = Math.max(0, Math.floor(Number(part?.cardsSeen ?? 0)));
      const corr = Math.max(0, Math.floor(Number(part?.cardsCorrect ?? 0)));
      aggSeen += seen;
      aggCorrect += Math.min(corr, seen);
    }
    cards_seen = aggSeen;
    cards_correct = aggCorrect;
  }
  // Clamp to reasonable bounds
  if (!Number.isFinite(cards_seen) || cards_seen < 0) cards_seen = 0;
  if (!Number.isFinite(cards_correct) || cards_correct < 0) cards_correct = 0;
  if (cards_correct > cards_seen) cards_correct = cards_seen;
  if (!bloom_level || Number.isNaN(score_pct)) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  // Insert attempt
  // Try to snapshot current contentVersion for this level
  let contentVersion: number | undefined = undefined;
  try {
    const sb = supabaseAdmin();
    const { data: row } = await sb
      .from("user_deck_quest_progress")
      .select("per_bloom")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckId)
      .maybeSingle();
    const per = (row?.per_bloom ?? {}) as Record<string, { contentVersion?: number }>;
    contentVersion = Number((per[bloom_level]?.contentVersion ?? 0) as number) || 0;
  } catch {}

  const attempt = await recordMissionAttempt({
    userId: session.user.id,
    deckId,
    bloomLevel: bloom_level,
    scorePct: score_pct,
    cardsSeen: cards_seen,
    cardsCorrect: cards_correct,
    startedAt: started_at,
    endedAt: ended_at,
    contentVersion,
    mode,
    breakdown,
  });
  if (!attempt.ok) return NextResponse.json({ error: attempt.error }, { status: 500 });

  // Update per_bloom aggregates for counters and averages first, then mark cleared/unlock idempotently.
  if ((mode ?? 'quest') === 'quest') {
    await updateQuestProgressOnComplete({ userId: session.user.id, deckId, level: bloom_level, scorePct: score_pct, cardsSeen: cards_seen });
  }

  // Unlock next on single pass (>=65) only for quest missions. Do this after progress update to avoid races.
  if ((mode ?? 'quest') === 'quest' && score_pct >= 65) {
    try { await unlockNextBloomLevel(session.user.id, deckId, bloom_level); } catch {}
  }

  // Adjust updatedSinceLastRun and add lastCompletion snapshot; never relock missionUnlocked
  try {
    const sb = supabaseAdmin();
    const { data: row } = await sb
      .from("user_deck_quest_progress")
      .select("id, per_bloom, xp")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckId)
      .maybeSingle();
  if (row?.per_bloom && (mode ?? 'quest') === 'quest') {
      type PB = Partial<{ updatedSinceLastRun: number; missionUnlocked: boolean; cleared: boolean; accuracyCount: number; lastCompletion: { percent: number; timestamp: string; attempts: number }; missionsPassed: number; totalMissions: number }>;
      const per = row.per_bloom as Record<string, PB>;
      const cur = (per[bloom_level] ?? {}) as PB;
      const was = Number(cur.updatedSinceLastRun ?? 0);
      const after = Math.max(0, was - Math.max(0, Number(cards_seen ?? 0)));
      per[bloom_level] = {
        ...cur,
        updatedSinceLastRun: after,
  missionUnlocked: Boolean(cur.missionUnlocked ?? cur.cleared ?? (Number(cur.missionsPassed ?? 0) > 0)),
        lastCompletion: { percent: score_pct, timestamp: ended_at ?? new Date().toISOString(), attempts: Number(cur.accuracyCount ?? 0) + 1 },
      };
      await sb
        .from("user_deck_quest_progress")
        .upsert({ user_id: session.user.id, deck_id: deckId, per_bloom: per, xp: row.xp ?? {} }, { onConflict: "user_id,deck_id" });
    }
  } catch {}

  // Update mastery aggregates (EWMA + retention + coverage)
  try {
    if (breakdown && typeof breakdown === 'object') {
      // Update each bloom present in the breakdown
      for (const key of Object.keys(breakdown)) {
        if ((BLOOM_LEVELS as string[]).includes(key)) {
          const lvl = key as DeckBloomLevel;
          const part = breakdown[key]! as { scorePct: number; cardsSeen?: number };
          const pct = Number(part?.scorePct ?? NaN);
          const seen = Number(part?.cardsSeen ?? 0);
          if (!Number.isNaN(pct) && seen > 0) {
            await updateBloomMastery({ userId: session.user.id, deckId, bloomLevel: lvl, lastScorePct: Math.max(0, Math.min(100, pct)) });
          }
        }
      }
    } else {
      // Fallback: update the attributed bloom only, but ignore 0-card attempts
      if (cards_seen > 0) {
        await updateBloomMastery({ userId: session.user.id, deckId, bloomLevel: bloom_level, lastScorePct: score_pct });
      }
    }
  } catch {}

  return NextResponse.json({ ok: true, attemptId: attempt.attemptId, unlocked: score_pct >= 65 });
}
