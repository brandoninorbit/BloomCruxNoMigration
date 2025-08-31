// src/server/progression/quest.ts
import type { DeckBloomLevel } from "@/types/deck-cards";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function recordMissionAttempt(params: {
  userId: string;
  deckId: number;
  bloomLevel: DeckBloomLevel;
  scorePct: number;
  cardsSeen: number;
  cardsCorrect: number;
  startedAt?: string | null;
  endedAt?: string | null;
  contentVersion?: number;
  mode?: 'quest' | 'remix' | 'drill' | 'study' | 'starred';
  breakdown?: Record<string, { scorePct: number; cardsSeen: number; cardsCorrect: number }>; // per-bloom summary
}): Promise<{ ok: true; attemptId?: number } | { ok: false; error: string }> {
  // Sanitize inputs and recompute aggregates if breakdown provided
  const MAX_ATTEMPTS_PER_MISSION = 500;
  let seenAgg = Math.max(0, Math.floor(Number(params.cardsSeen) || 0));
  let corrAgg = Math.max(0, Math.floor(Number(params.cardsCorrect) || 0));
  if (params.breakdown && typeof params.breakdown === 'object') {
    let s = 0, c = 0;
    for (const v of Object.values(params.breakdown)) {
      const t = Math.max(0, Math.floor(Number(v?.cardsSeen ?? 0)));
      const cc = Math.max(0, Math.floor(Number(v?.cardsCorrect ?? 0)));
      s += t;
      c += Math.min(cc, t);
    }
    seenAgg = s;
    corrAgg = c;
  }
  const cardsSeenSafe = Math.min(MAX_ATTEMPTS_PER_MISSION, seenAgg);
  const cardsCorrectSafe = Math.min(cardsSeenSafe, corrAgg);
  const scorePctSafe = Math.max(0, Math.min(100, Number(params.scorePct) || 0));
  // Some databases may not allow certain custom modes (e.g., 'starred') via a CHECK constraint.
  // Clamp to an allowed set to avoid insert failures when schemas lag behind.
  const modeSafe = ((): 'quest' | 'remix' | 'drill' | 'study' | null => {
    const m = params.mode as 'quest' | 'remix' | 'drill' | 'study' | 'starred' | undefined;
    if (!m) return 'quest'; // default to quest when not provided
  if (m === 'quest' || m === 'remix' || m === 'drill' || m === 'study') return m;
  return null;
  })();
  const basePayload: Record<string, unknown> = {
    user_id: params.userId,
    deck_id: params.deckId,
    bloom_level: params.bloomLevel,
    score_pct: scorePctSafe,
    cards_seen: cardsSeenSafe,
    cards_correct: cardsCorrectSafe,
    started_at: params.startedAt ?? null,
    ended_at: params.endedAt ?? new Date().toISOString(),
    mode: modeSafe,
    breakdown: params.breakdown ? (params.breakdown as unknown as object) : null,
  } as const;
  const withContentVersion: Record<string, unknown> = (Number.isFinite(params.contentVersion as number))
    ? { ...basePayload, content_version: params.contentVersion as number }
    : basePayload;

  function payloadVariants(): Array<Record<string, unknown>> {
    const noCV = { ...basePayload } as Record<string, unknown>;
    const noCVNoMode = { ...noCV, mode: null };
    const noCVNoBreakdown = { ...noCV } as Record<string, unknown>;
    delete (noCVNoBreakdown as Record<string, unknown>)['breakdown'];
    const noCVNoModeNoBreakdown = { ...noCVNoBreakdown, mode: null };
    const withCVNoMode = { ...withContentVersion, mode: null };
    const withCVNoBreakdown = { ...withContentVersion } as Record<string, unknown>;
    delete (withCVNoBreakdown as Record<string, unknown>)['breakdown'];
    const withCVNoModeNoBreakdown = { ...withCVNoBreakdown, mode: null };
    const list: Array<Record<string, unknown>> = [];
    // Prefer with CV first if present
    if (withContentVersion !== basePayload) {
      list.push(withContentVersion, withCVNoMode, withCVNoBreakdown, withCVNoModeNoBreakdown);
    }
    list.push(noCV, noCVNoMode, noCVNoBreakdown, noCVNoModeNoBreakdown);
    return list;
  }

  async function tryInsert(client: ReturnType<typeof supabaseAdmin> | ReturnType<typeof createServerClient>): Promise<{ ok: true; attemptId?: number } | { ok: false; error: string }> {
    try {
      const variants = payloadVariants();
      let lastErr: string | null = null;
      for (const p of variants) {
        const { data, error } = await client
          .from("user_deck_mission_attempts")
          .insert(p)
          .select("id")
          .maybeSingle();
        if (!error) return { ok: true, attemptId: (data as { id: number } | null | undefined)?.id };
        lastErr = String(error?.message || "insert failed");
        // continue to next variant
      }
      return { ok: false, error: lastErr || "insert failed" };
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? (e as { message: string }).message : String(e);
      return { ok: false, error: msg };
    }
  }

  // First: try with a session-bound server client (RLS must allow user_id = auth.uid())
  try {
    type CookieAdapter = { get: (name: string) => { value: string } | undefined; set: (name: string, value: string, options?: Record<string, unknown>) => void };
    const jar = cookies() as unknown as CookieAdapter;
    const sbUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            try { return jar.get(name)?.value; } catch { return undefined; }
          },
          set(name: string, value: string, options?: Record<string, unknown>) {
            try { jar.set(name, value, options); } catch {}
          },
          remove(name: string, options?: Record<string, unknown>) {
            try { jar.set(name, '', { ...(options || {}), maxAge: 0 }); } catch {}
          },
        },
        auth: { autoRefreshToken: false, detectSessionInUrl: false },
      }
    );
  const res = await tryInsert(sbUser);
  if (res.ok) return res;
  return res;
  } catch {
    // Fall through to admin client as last resort
  }

  // Last resort: admin client (bypasses RLS)
  try {
    const sb = supabaseAdmin();
    const res = await tryInsert(sb);
    if (res.ok) return res;
    return res;
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? (e as { message: string }).message : String(e);
    return { ok: false, error: msg };
  }
}

export async function unlockNextBloomLevel(userId: string, deckId: number, levelJustPassed: DeckBloomLevel): Promise<void> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("user_deck_quest_progress")
    .select("id, per_bloom")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .maybeSingle();
  const per = (data?.per_bloom ?? {}) as Record<string, Record<string, unknown>>;
  const cur = per[levelJustPassed] ?? {};
  if ((cur as Record<string, unknown>).cleared === true) return; // idempotent
  per[levelJustPassed] = { ...cur, cleared: true } as Record<string, unknown>;
  await sb
    .from("user_deck_quest_progress")
    .upsert({ user_id: userId, deck_id: deckId, per_bloom: per }, { onConflict: "user_id,deck_id" });
}

// Ensure per_bloom totals exist and aggregate mission counters on completion
export async function updateQuestProgressOnComplete(params: {
  userId: string;
  deckId: number;
  level: DeckBloomLevel;
  scorePct: number; // 0..100
  cardsSeen: number;
}): Promise<void> {
  const sb = supabaseAdmin();
  const [{ data: row }, { data: cardRows }] = await Promise.all([
    sb.from("user_deck_quest_progress").select("id, per_bloom, xp").eq("user_id", params.userId).eq("deck_id", params.deckId).maybeSingle(),
    sb
      .from("cards")
      .select("bloom_level")
      .eq("deck_id", params.deckId),
  ]);
  const cap = DEFAULT_QUEST_SETTINGS.missionCap;
  type PerBloomItem = {
    totalCards: number;
    totalMissions: number;
    completedCards: number;
    missionsCompleted: number;
  missionsPassed: number;
    masteryPercent: number;
    mastered: boolean;
    commanderGranted: boolean;
    accuracySum: number;
    accuracyCount: number;
    recentAttempts: unknown[];
    weightedAvg: number;
    cleared: boolean;
  };
  type PerBloom = Record<DeckBloomLevel, Partial<PerBloomItem>>;
  const per = (row?.per_bloom ?? {}) as unknown as PerBloom;
  // Build a map of total cards by bloom
  const map: Record<DeckBloomLevel, number> = { Remember: 0, Understand: 0, Apply: 0, Analyze: 0, Evaluate: 0, Create: 0 };
  for (const c of (cardRows ?? []) as Array<{ bloom_level: DeckBloomLevel | null }>) {
    const lvl = (c.bloom_level ?? "Remember") as DeckBloomLevel;
    map[lvl] = (map[lvl] ?? 0) + 1;
  }
  // Ensure per_bloom has totals for all levels
  for (const lvl of BLOOM_LEVELS as DeckBloomLevel[]) {
  const cur = (per[lvl] ?? {}) as Partial<PerBloomItem>;
  const computedTotal = map[lvl] ?? 0;
  const totalCards = computedTotal > 0 ? computedTotal : Number(cur.totalCards ?? 0);
    const totalMissions = Math.ceil(totalCards / cap) || 0;
  const built: PerBloomItem = {
      totalCards,
      totalMissions,
      completedCards: Number(cur.completedCards ?? 0),
      missionsCompleted: Number(cur.missionsCompleted ?? 0),
      missionsPassed: Number(cur.missionsPassed ?? 0),
      masteryPercent: Number(cur.masteryPercent ?? 0),
      mastered: Boolean(cur.mastered ?? false),
      commanderGranted: Boolean(cur.commanderGranted ?? false),
      accuracySum: Number(cur.accuracySum ?? 0),
      accuracyCount: Number(cur.accuracyCount ?? 0),
      recentAttempts: Array.isArray(cur.recentAttempts) ? cur.recentAttempts : [],
      weightedAvg: Number(cur.weightedAvg ?? 0),
      cleared: Boolean(cur.cleared ?? false),
    };
  per[lvl] = built;
  }
  // Update aggregates for the just-completed level
  const cur = (per[params.level] ?? {}) as Partial<PerBloomItem>;
  cur.missionsCompleted = Number(cur.missionsCompleted ?? 0) + 1;
  // Only increment missionsPassed when passing threshold
  if ((params.scorePct ?? 0) >= 65) {
    cur.missionsPassed = Number(cur.missionsPassed ?? 0) + 1;
  }
  const before = Number(cur.completedCards ?? 0);
  const totalCards = Number(cur.totalCards ?? 0);
  cur.completedCards = Math.min(totalCards, before + Math.max(0, Number(params.cardsSeen ?? 0)));
  cur.accuracySum = Number(cur.accuracySum ?? 0) + Math.max(0, Math.min(1, (Number(params.scorePct ?? 0) / 100)));
  cur.accuracyCount = Number(cur.accuracyCount ?? 0) + 1;
  // Maintain a small recent attempts window (newest first)
  const recent = Array.isArray(cur.recentAttempts) ? [...(cur.recentAttempts as Array<{ percent: number; at: string }>)] : [];
  recent.unshift({ percent: Math.round(Math.max(0, Math.min(100, params.scorePct))), at: new Date().toISOString() });
  while (recent.length > 10) recent.pop();
  cur.recentAttempts = recent;
  // Optional weighted average for quick UI
  const weights = recent.map((_, i) => Math.pow(0.8, i));
  const denom = weights.reduce((a, b) => a + b, 0) || 1;
  const wavg = recent.reduce((s, r, i) => s + (r.percent * weights[i]), 0) / denom;
  cur.weightedAvg = Math.round(wavg);
  // Single-pass clear flag
  if ((params.scorePct ?? 0) >= 65) cur.cleared = true;
  per[params.level] = cur;
  await sb
    .from("user_deck_quest_progress")
    .upsert({ user_id: params.userId, deck_id: params.deckId, per_bloom: per, xp: row?.xp ?? {} }, { onConflict: "user_id,deck_id" });
}
