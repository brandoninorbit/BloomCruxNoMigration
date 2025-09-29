"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MinimalUserLike } from "@/lib/userProfile";
import AgentCard from "@/components/AgentCard";
import { resolveUserDisplay } from "@/lib/userProfile";
import { getSupabaseClient } from "@/lib/supabase/browserClient";

type MissionSummary = {
  deckId: number | null;
  deckTitle: string;
  modeLabel: string; // e.g., Quest, Topic Trek, Timed Drill
  accuracyPercent: number;
  answered: number;
  xpEarned: number;
  tokensEarned: number;
  commanderLevel: number; // derived from commanderXpTotal
  user: { name: string; avatarUrl?: string | null } | null;
};

export default function MissionCompleteDevPage() {
  const fitRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    function recompute() {
      const el = fitRef.current;
      if (!el) return;
      const viewportH = window.innerHeight;
      // Allow a little breathing room
      const margin = 24; // px
      const contentH = el.scrollHeight; // natural (unscaled) height
      const nextScale = Math.min(1, (viewportH - margin * 2) / contentH);
      setScale(Number(nextScale.toFixed(3)));
    }
    recompute();
    const r = () => recompute();
    window.addEventListener('resize', r);
    // Recompute after fonts/images settle
    const t = setTimeout(recompute, 120);
    return () => { window.removeEventListener('resize', r); clearTimeout(t); };
  }, []);

  return (
    <main className="min-h-screen bg-[var(--background-color)] text-[var(--text-primary)] antialiased overflow-hidden flex flex-col items-center">
      <div className="relative w-full flex flex-col items-center p-4 lg:p-6" style={{ flex: '0 0 auto' }}>
        <div
          ref={fitRef}
          style={{
            // Primary: CSS zoom shrinks layout box so page height reduces
            // Fallback: transform for browsers without zoom support
            zoom: scale < 1 ? scale : 1,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top center',
            width: '100%',
          }}
          className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"
          data-scale={scale}
        >

          {/* Left column: Real AgentCard, stretched to match panel height */}
          <LeftAgentCard />

          {/* Main panel */}
          <MissionPanel />

          
        </div>
      </div>
    </main>
  );
}

/* ---------------- Client subcomponents ---------------- */

function LeftAgentCard() {
  const [summary, setSummary] = useState<MissionSummary | null>(null);

  useEffect(() => { void loadSummary().then(setSummary); }, []);

  const { firstName, avatarUrl } = resolveUserDisplay(summary?.user ? ({ email: undefined, user_metadata: { full_name: summary.user.name, avatar_url: summary.user.avatarUrl } } as MinimalUserLike) : null);
  return (
    <div className="lg:col-span-1 flex justify-center lg:justify-start">
      <div className="w-full h-full flex items-stretch">
        <AgentCard
          displayName={firstName}
          level={summary?.commanderLevel ?? 1}
          tokens={Math.max(0, Math.round(summary?.tokensEarned ?? 0))}
          avatarUrl={avatarUrl}
          className="h-full aspect-auto lg:max-w-none"
          variant="study"
          outerScale={1.2}
        />
      </div>
    </div>
  );
}

function MissionPanel() {
  const [summary, setSummary] = useState<MissionSummary | null>(null);
  useEffect(() => { void loadSummary().then(setSummary); }, []);

  const stats = useMemo(() => ([
    { k: "XP Earned", v: `+${Math.max(0, Math.round(summary?.xpEarned ?? 0))}`, c: "--hud-blue" },
    { k: "Tokens", v: `+${Math.max(0, Math.round(summary?.tokensEarned ?? 0))}`, c: "--hud-yellow" },
    { k: "Accuracy", v: `${Number.isFinite(summary?.accuracyPercent as number) ? (Math.max(0, Math.min(100, Number(summary!.accuracyPercent))).toFixed(1)) : "0.0"}%`, c: "--hud-green" },
    { k: "Answered", v: `${Math.max(0, Math.round(summary?.answered ?? 0))}` , c: "--hud-purple" },
  ]), [summary]);

  return (
  <section className="lg:col-span-2 bg-[var(--secondary-color)]/90 backdrop-blur-sm rounded-xl p-5 md:p-6 shadow-sm border border-slate-200 relative h-full flex flex-col">
  <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--primary-color)]">Mission Complete</p>
          <p className="text-[var(--text-secondary)] text-lg">
            {summary?.modeLabel || "Quest"} — {summary?.deckTitle || "Your Latest Deck"}
          </p>
        </div>
        <div className="w-full md:w-auto">
          <div
            className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={100}
            aria-label="Mission completion"
          >
            <div className="h-full bg-[var(--primary-color)] rounded-full" style={{ width: "100%" }} />
          </div>
          <p className="text-xs text-center mt-1 text-[var(--text-secondary)]">100% Complete</p>
        </div>
      </header>

      {/* Seal */}
      <div className="flex flex-col items-center text-center my-6 md:my-8">
        <div className="relative w-28 h-28 mb-4 md:w-32 md:h-32 md:mb-5">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--primary-color)]/20 animate-rotate-slow" />
          <div className="absolute inset-2 rounded-full border-2 border-[var(--primary-color)]/30 animate-rotate-slow" style={{ animationDirection: "reverse" }} />
          <div className="w-full h-full flex items-center justify-center animate-pulse-glow rounded-full bg-white">
            <svg className="w-20 h-20 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
  <h1 className="text-3xl md:text-[2rem] font-bold leading-tight">Agent, mission accomplished.</h1>
  <p className="text-base md:text-lg text-[var(--text-secondary)] mt-2 max-w-md">You have successfully completed your objective.</p>
      </div>

      {/* Stats */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map(({ k, v, c }) => (
          <div
            key={k}
            className="rounded-lg p-4 border text-center shadow-sm"
            style={{
              backgroundColor: `color-mix(in srgb, var(${c}), white 90%)`,
              borderColor: `color-mix(in srgb, var(${c}), transparent 70%)`,
            }}
          >
            <p className="text-sm font-semibold" style={{ color: `var(${c})` }}>{k}</p>
            <p className="text-2xl font-extrabold" style={{ color: `var(${c})` }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
  <div className="mt-auto flex flex-col sm:flex-row justify-center gap-3 pt-2">
        <button
          type="button"
          className="bg-white text-[var(--text-primary)] border border-slate-300 rounded-lg px-6 py-3 font-semibold hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-white transition-all duration-200"
        >
          Return to HQ
        </button>
        <button
          type="button"
          className="bg-[var(--primary-color)] text-white rounded-lg px-6 py-3 font-semibold hover:bg-[var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 focus:ring-offset-white transition-all duration-200 shadow-lg shadow-[var(--primary-color)]/15"
        >
          Start New Mission
        </button>
      </div>
    </section>
  );
}

async function loadSummary(): Promise<MissionSummary> {
  const supabase = getSupabaseClient();
  const [{ data: userData }, { data: eventsRes }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("user_xp_events")
      .select("id, deck_id, bloom_level, event_type, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const user = userData?.user ?? null;
  type XpEvent = { id: number; deck_id: number; bloom_level: string; event_type: string; payload: unknown; created_at: string };
  const events = (eventsRes ?? []) as XpEvent[];
  // Optional deckId filter via query
  let deckFilter: number | null = null;
  try {
    const u = new URL(window.location.href);
    const qDeck = u.searchParams.get("deckId");
    if (qDeck) {
      const n = Number(qDeck);
      if (Number.isFinite(n)) deckFilter = n;
    }
  } catch {}

  // Find the latest completed mission window
  const completedIdx = events.findIndex((e) => e.event_type === "mission_completed" && (deckFilter ? e.deck_id === deckFilter : true));
  const latestCompleted = completedIdx >= 0 ? events[completedIdx] : null;
  const startedAfterIdx = completedIdx >= 0 ? events.slice(completedIdx + 1).findIndex((e) => e.event_type === "mission_started") : -1;
  const started = startedAfterIdx >= 0 ? events[completedIdx + 1 + startedAfterIdx] : null;

  let xpEarned = 0;
  let accuracyPercent = 0;
  let answered = 0;
  let deckId: number | null = null;
  let deckTitle = "";
  if (latestCompleted) {
    deckId = latestCompleted.deck_id ?? null;
    const endTime = new Date(latestCompleted.created_at).getTime();
    const startTime = started ? new Date(started.created_at).getTime() : 0;
    for (const e of events) {
      const t = new Date(e.created_at).getTime();
      if (t < startTime || t > endTime) continue;
      if (e.event_type === "xp_bloom_added" || e.event_type === "xp_commander_added") {
        const payload = (e.payload ?? {}) as Record<string, unknown>;
        const amtRaw = payload["amount"];
        const amt = typeof amtRaw === "number" ? amtRaw : Number(amtRaw ?? 0);
        if (!Number.isNaN(amt)) xpEarned += amt;
      }
    }
    const p = (latestCompleted.payload ?? {}) as Record<string, unknown>;
    const correct = typeof p["correct"] === "number" ? (p["correct"] as number) : Number(p["correct"] ?? 0);
    const total = typeof p["total"] === "number" ? (p["total"] as number) : Number(p["total"] ?? 0);
    answered = Number.isFinite(total) ? total : 0;
  accuracyPercent = total > 0 ? Math.round(((correct / total) * 100) * 10) / 10 : 0;
  }

  // Deck title and per-deck commander XP (for level)
  let commanderXpTotal = 0;
  if (deckId) {
    const [deckResp, progResp] = await Promise.all([
      supabase.from("decks").select("title").eq("id", deckId).maybeSingle(),
      fetch(`/api/quest/${deckId}/progress`, { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.resolve(null)).catch(() => null),
    ]);
    if (!deckResp.error && deckResp.data?.title) deckTitle = String(deckResp.data.title);
  const xp = (progResp && (progResp as { xp?: { commanderXpTotal?: number } }).xp) || null;
    if (xp && typeof xp.commanderXpTotal === "number") commanderXpTotal = xp.commanderXpTotal;
  }

  const commanderLevel = 1 + Math.floor(commanderXpTotal / 100);
  const tokensEarned = Math.max(0, Math.round(xpEarned * 0.25)); // tokens = 0.25 * xp

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "Agent";
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) || (user?.user_metadata?.picture as string | undefined) || null;

  // Mode label: allow URL hint (?mode=topics|timed), else default to Quest
  let modeLabel = "Quest";
  try {
    const u = new URL(window.location.href);
    const m = u.searchParams.get("mode");
    if (m) modeLabel =
      m === "topics" ? "Topic Trek" :
      m === "timed" ? "Timed Drill" :
      m === "boost" ? "Boost" : "Quest";
  } catch {}

  const summary: MissionSummary = {
    deckId,
    deckTitle: deckTitle || "",
    modeLabel,
    accuracyPercent,
    answered,
    xpEarned,
    tokensEarned,
    commanderLevel,
    user: user ? { name: displayName, avatarUrl } : null,
  };
  return summary;
}
