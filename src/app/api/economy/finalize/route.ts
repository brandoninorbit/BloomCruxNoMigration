import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/app/supabase/session";
import { XP_MODEL, type BloomLevel } from "@/lib/xp";

// Finalize a mission completion by minting commander XP and tokens to the user's wallet.
// Body: { deckId: number, mode?: string, correct?: number, total?: number, percent?: number }
// Policy: idempotent per matching (deckId, mode, correct, total) within a short window.
type FinalizeBody = { deckId?: unknown; mode?: unknown; correct?: unknown; total?: unknown; percent?: unknown; breakdown?: unknown };

export async function POST(req: NextRequest) {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as FinalizeBody;
  const deckId = Number(body?.deckId ?? NaN);
  const mode = String(body?.mode ?? "remix");
  let correct = Number(body?.correct ?? NaN);
  let total = Number(body?.total ?? NaN);
  let percent = Number(body?.percent ?? (Number.isFinite(correct) && Number.isFinite(total) && total > 0 ? (correct / total) * 100 : NaN));
  const breakdownRaw = body?.breakdown as Record<string, { correct?: unknown; total?: unknown }> | undefined;
  const MAX_ATTEMPTS_PER_MISSION = 500;
  // Normalize breakdown to BloomLevel keys if provided
  let breakdown: Partial<Record<BloomLevel, { correct: number; total: number }>> | undefined = undefined;
  if (breakdownRaw && typeof breakdownRaw === 'object') {
    const map: Partial<Record<BloomLevel, { correct: number; total: number }>> = {};
    for (const k of Object.keys(breakdownRaw)) {
      const key = String(k) as BloomLevel;
      const v = breakdownRaw[k] as { correct?: unknown; total?: unknown };
      const c0 = Number(v?.correct ?? NaN);
      const t0 = Number(v?.total ?? NaN);
      if (Number.isFinite(c0) || Number.isFinite(t0)) {
        const t = Math.max(0, Math.min(MAX_ATTEMPTS_PER_MISSION, Math.floor(Number.isFinite(t0) ? t0 : 0)));
        const c = Math.max(0, Math.min(t, Math.floor(Number.isFinite(c0) ? c0 : 0)));
        if (t > 0) map[key] = { correct: c, total: t };
      }
    }
    breakdown = map;
  }

  if (!Number.isFinite(deckId) || deckId <= 0) return NextResponse.json({ error: "invalid deckId" }, { status: 400 });
  // If a breakdown is provided, recompute aggregate correct/total to ensure consistency
  if (breakdown && Object.keys(breakdown).length > 0) {
    let aggTotal = 0;
    let aggCorrect = 0;
    for (const v of Object.values(breakdown)) {
      const t = Math.max(0, Math.floor(Number(v?.total ?? 0)));
      const c = Math.max(0, Math.floor(Number(v?.correct ?? 0)));
      aggTotal += t;
      aggCorrect += Math.min(c, t);
    }
    // Cap aggregates to mission max
    if (aggTotal > MAX_ATTEMPTS_PER_MISSION) {
      const scale = MAX_ATTEMPTS_PER_MISSION / Math.max(1, aggTotal);
      aggCorrect = Math.floor(Math.min(aggCorrect * scale, MAX_ATTEMPTS_PER_MISSION));
      aggTotal = MAX_ATTEMPTS_PER_MISSION;
    } else {
      aggCorrect = Math.min(aggCorrect, MAX_ATTEMPTS_PER_MISSION);
    }
    total = aggTotal;
    correct = Math.min(aggCorrect, total);
    percent = aggTotal > 0 ? (aggCorrect / aggTotal) * 100 : 0;
  }
  // If no breakdown, cap as well
  if (!breakdown || Object.keys(breakdown).length === 0) {
    total = Math.max(0, Math.min(MAX_ATTEMPTS_PER_MISSION, Math.floor(Number(total) || 0)));
    correct = Math.max(0, Math.min(total, Math.floor(Number(correct) || 0)));
  }
  if (!Number.isFinite(correct) || correct < 0) return NextResponse.json({ error: "invalid correct" }, { status: 400 });
  if (!Number.isFinite(total) || total < 0) return NextResponse.json({ error: "invalid total" }, { status: 400 });
  const pct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;

  // XP calculation (unchanged)
  const commanderDelta = (breakdown && Object.keys(breakdown).length > 0)
    ? XP_MODEL.awardForBreakdown(breakdown)
    : XP_MODEL.awardForMission({ correct, total, bloom: "Remember" });

  const sb = supabaseAdmin();

  // New token calculation based on mission completion
  let tokensDelta = 0;
  let primaryBloomLevel: BloomLevel = 'Remember';

  if (pct >= 65) {
    // Determine the primary bloom level for token calculation
    if (breakdown && Object.keys(breakdown).length > 0) {
      // Use the bloom level with the most correct answers
      const bloomEntries = Object.entries(breakdown) as [BloomLevel, { correct: number; total: number }][];
      const primaryBloom = bloomEntries.reduce((max, [bloom, stats]) =>
        stats.correct > max.stats.correct ? { bloom, stats } : max,
        { bloom: 'Remember' as BloomLevel, stats: { correct: 0, total: 0 } }
      );
      primaryBloomLevel = primaryBloom.bloom;
    }

    // Calculate base tokens
    const baseTokens = (() => {
      switch (primaryBloomLevel) {
        case 'Remember': return 12;
        case 'Understand': return 18;
        case 'Apply': return 24;
        case 'Analyze': return 30;
        case 'Evaluate': return 36;
        case 'Create': return 45;
        default: return 12;
      }
    })();

    // Quality bonus for >=85%
    const qualityBonus = pct >= 85 ? Math.floor(baseTokens * 0.33) : 0;

    tokensDelta = baseTokens + qualityBonus;

    // Check for diminishing returns
    const diminishingMultiplier = await sb.rpc('get_diminishing_returns_multiplier', {
      p_user_id: userId,
      p_date: new Date().toISOString().split('T')[0]
    });

    tokensDelta = Math.floor(tokensDelta * Number(diminishingMultiplier || 1.0));

    // Increment daily payout count
    await sb.rpc('increment_daily_payout_count', { p_user_id: userId });
  }

  // Idempotency: if a matching mission_completed for this payload exists recently, do not double-apply
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: existing } = await sb
    .from("user_xp_events")
    .select("id, payload, created_at")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("event_type", "mission_completed")
    .gte("created_at", fifteenMinAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  const already = (existing ?? []).some((e) => {
    try {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const m = String(p["mode"] ?? "");
      const c = Number(p["correct"] ?? NaN);
      const t = Number(p["total"] ?? NaN);
      return m === mode && Number.isFinite(c) && Number.isFinite(t) && c === correct && t === total;
    } catch { return false; }
  });

  if (!already) {
    // Log mission_completed and commander XP event for audit
  const payload = { mode, correct, total, percent: pct, breakdown };
    const { error: e1 } = await sb
      .from("user_xp_events")
      .insert({ user_id: userId, deck_id: deckId, bloom_level: "Remember", event_type: "mission_completed", payload });
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    if (commanderDelta > 0) {
      const { error: e2 } = await sb
        .from("user_xp_events")
  .insert({ user_id: userId, deck_id: deckId, bloom_level: "Remember", event_type: "xp_commander_added", payload: { amount: commanderDelta, mode } });
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    }

    // Upsert wallet totals via RPC to increment (only XP now)
    const { error: e3 } = await sb.rpc("increment_user_economy", { p_user_id: userId, p_tokens_delta: 0, p_xp_delta: commanderDelta });
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

    // Check for first-clear bonus
    if (pct >= 65) {
      const existingFirstClear = await sb
        .from('user_deck_first_clears')
        .select('id')
        .eq('user_id', userId)
        .eq('deck_id', deckId)
        .eq('bloom_level', primaryBloomLevel)
        .maybeSingle();

      if (!existingFirstClear.data) {
        const firstClearTokens = primaryBloomLevel === 'Create' ? 50 : 25;
        await sb.rpc('award_tokens', {
          p_user_id: userId,
          p_tokens: firstClearTokens,
          p_event_type: 'first_clear',
          p_bloom_level: primaryBloomLevel,
          p_deck_id: deckId
        });

        await sb
          .from('user_deck_first_clears')
          .insert({
            user_id: userId,
            deck_id: deckId,
            bloom_level: primaryBloomLevel,
            tokens_awarded: firstClearTokens
          });
      }
    }

    // Check for mastery milestone (80% mastery at this bloom level)
    const masteryData = await sb
      .from('user_deck_bloom_mastery')
      .select('mastery_pct')
      .eq('user_id', userId)
      .eq('deck_id', deckId)
      .eq('bloom_level', primaryBloomLevel)
      .maybeSingle();

    if (masteryData.data && masteryData.data.mastery_pct >= 80) {
      const existingMilestone = await sb
        .from('user_mastery_milestones')
        .select('id')
        .eq('user_id', userId)
        .eq('deck_id', deckId)
        .eq('bloom_level', primaryBloomLevel)
        .maybeSingle();

      if (!existingMilestone.data) {
        const milestoneTokens = primaryBloomLevel === 'Create' ? 150 : 75;
        await sb.rpc('award_tokens', {
          p_user_id: userId,
          p_tokens: milestoneTokens,
          p_event_type: 'mastery_milestone',
          p_bloom_level: primaryBloomLevel,
          p_deck_id: deckId
        });

        await sb
          .from('user_mastery_milestones')
          .insert({
            user_id: userId,
            deck_id: deckId,
            bloom_level: primaryBloomLevel,
            mastery_pct: masteryData.data.mastery_pct,
            tokens_awarded: milestoneTokens
          });
      }
    }

    // Award mission completion tokens if mission passed
    if (tokensDelta > 0) {
      await sb.rpc('award_tokens', {
        p_user_id: userId,
        p_tokens: tokensDelta,
        p_event_type: 'mission_completion',
        p_bloom_level: primaryBloomLevel,
        p_deck_id: deckId
      });
    }

    // After increment, compute commander_level and persist
    const { data: row1, error: e4 } = await sb.from("user_economy").select("commander_xp").eq("user_id", userId).maybeSingle();
    if (!e4) {
      const totalXp = Number(row1?.commander_xp ?? 0);
  const calcLevel = XP_MODEL.progressFor(totalXp).level;
      await sb.from("user_economy").update({ commander_level: calcLevel }).eq("user_id", userId);
    }
  }

  // Return wallet (tokens are awarded separately now)
  const { data: walletRow, error } = await sb.from("user_economy").select("tokens, commander_xp, commander_level").eq("user_id", userId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tokens: Number(walletRow?.tokens ?? 0), commander_xp: Number(walletRow?.commander_xp ?? 0), commander_level: Number(walletRow?.commander_level ?? 1), xpDelta: commanderDelta });
}
