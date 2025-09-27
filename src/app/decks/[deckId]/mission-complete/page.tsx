// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPercent1 } from "@/lib/utils";
import { useParams, useSearchParams } from "next/navigation";
import AgentCard from "@/components/AgentCard";
import { XP_MODEL } from "@/lib/xp";
import { getSupabaseClient } from "@/lib/supabase/browserClient";
import { BLOOM_LEVELS } from "@/types/card-catalog";
import AccuracyDetailsModal, { type MissionAnswer } from "@/components/AccuracyDetailsModal";
import * as cardsRepo from "@/lib/cardsRepo";
import { getUnlocksNewBetween } from "@/lib/unlocks";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";
import type { DeckBloomLevel } from "@/types/deck-cards";

type MissionSummary = {
  deckId: number | null;
  deckTitle: string;
  modeLabel: string;
  accuracyPercent: number;
  correct?: number;
  total?: number;
  answered: number;
  xpEarned: number;
  tokensEarned: number;
  tokensBalance?: number;
  commanderLevel: number;
  commanderLevelPrev?: number;
  user: { name: string; avatarUrl?: string | null } | null;
  nextHref?: string | null;
  unlocked?: boolean;
  perBloomRaw?: unknown;
};

export default function MissionCompleteProdPage() {
  const params = useParams() as { deckId?: string } | null;
  const sp = useSearchParams();
  const deckId = params?.deckId ? Number(params.deckId) : null;
  const mode = sp?.get("mode");
  const unlocked = sp?.get("unlocked");
  const pct = sp?.get("pct");
  const level = sp?.get("level");

  return (
    <main className="min-h-screen bg-[var(--background-color)] text-[var(--text-primary)] antialiased">
      <div className="relative flex flex-col items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          <LeftAgentCard deckId={deckId} />
          <MissionPanel deckId={deckId} mode={mode ?? null} unlockedParam={unlocked} pctParam={pct} levelParam={level} />
        </div>
      </div>
    </main>
  );
}

function LevelUpMasteryResult({ deckId, level }: { deckId: number | null; level: DeckBloomLevel }) {
  const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const startHint = sp?.get("startMastery");
  const [startPct, setStartPct] = useState<number | null>(startHint ? Math.max(0, Math.min(100, Math.round(Number(startHint)))) : null);
  const [postPct, setPostPct] = useState<number | null>(null);
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (deckId === null) return;
      try {
  const res = await fetch(`/api/decks/${deckId}/mastery`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (ignore) return;
  const mastery = (res?.mastery ?? {}) as Partial<Record<DeckBloomLevel, number>>;
  const after = Number(mastery?.[level] ?? NaN);
        const nextPost = Number.isFinite(after) ? Math.max(0, Math.min(100, Math.round(after))) : null;
        setPostPct(nextPost);
        if (startPct === null && nextPost !== null) setStartPct(nextPost);
      } catch {}
    })();
    return () => { ignore = true; };
  }, [deckId, level, startPct]);

  const pctStart = Math.max(0, Math.round(startPct ?? 0));
  const pctNew = Math.max(0, Math.round(postPct ?? startPct ?? 0));
  const grew = pctNew > pctStart;
  const delta = pctNew - pctStart;
  return (
    <div className="mb-6">
      <div className="mb-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 text-sm">
        {`Bloom ${level} mastery ${grew ? "increased" : "updated"} to ${pctNew}%${Number.isFinite(delta) && delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta}%)` : ""}.`}
      </div>
      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden" aria-label="New mastery percent">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pctNew}%`, backgroundColor: "var(--primary-color)" }} />
      </div>
    </div>
  );
}

function LeftAgentCard({ deckId }: { deckId: number | null }) {
  const [summary, setSummary] = useState<MissionSummary | null>(null);
  useEffect(() => { if (deckId !== null) void loadSummary(deckId, null).then(setSummary); }, [deckId]);
  const fullName = summary?.user?.name || "Agent";
  const firstName = useMemo(() => {
    try {
      const n = String(fullName);
      // handle names with spaces or underscores; if email-like, take part before dot/plus
      if (n.includes(" ")) return n.split(" ")[0] || n;
      if (n.includes("_")) return n.split("_")[0] || n;
      if (n.includes("@")) {
        const local = n.split("@")[0] || n;
        return (local.split(".")[0] || local.split("+")[0] || local) || n;
      }
      return n;
    } catch { return fullName; }
  }, [fullName]);
  return (
    <div className="lg:col-span-1 flex justify-center lg:justify-start">
      <div className="w-full h-full">
        <AgentCard
          displayName={firstName}
          level={summary?.commanderLevel ?? 1}
          tokens={Math.max(0, Math.round(summary?.tokensBalance ?? 0))}
          avatarUrl={summary?.user?.avatarUrl}
          className="h-full aspect-auto lg:max-w-none"
        />
      </div>
    </div>
  );
}

function MissionPanel({ deckId, mode, unlockedParam, pctParam, levelParam }: { deckId: number | null; mode: string | null; unlockedParam?: string | null; pctParam?: string | null; levelParam?: string | null }) {
  const [summary, setSummary] = useState<MissionSummary | null>(null);
  const [accuracyOpen, setAccuracyOpen] = useState(false);
  const [answers, setAnswers] = useState<MissionAnswer[] | null>(null);
  interface SimpleCardMeta { id: number; front?: string; back?: string; question?: string; prompt?: string; name?: string; explanation?: string; answer?: string; suggestedAnswer?: string }
  const [cardsById, setCardsById] = useState<Record<number, SimpleCardMeta>>({});
  useEffect(() => { if (deckId !== null) void loadSummary(deckId, mode, { unlockedParam, pctParam, levelParam }).then(setSummary); }, [deckId, mode, unlockedParam, pctParam, levelParam]);
  const stats = useMemo(() => ([
    { k: "XP Earned", v: `+${Math.max(0, Math.round(summary?.xpEarned ?? 0))}` , c: "--hud-blue" },
    { k: "Tokens", v: `+${Math.max(0, Math.round(summary?.tokensEarned ?? 0))}` , c: "--hud-yellow" },
  { k: "Accuracy", v: `${formatPercent1(Number(summary?.accuracyPercent ?? 0))}`, c: "--hud-green", interactive: true },
  { k: "Correct / Total", v: `${typeof summary?.correct === "number" ? Math.max(0, Math.round(summary.correct)) : "–"} / ${typeof summary?.total === "number" ? Math.max(0, Math.round(summary.total)) : (Number.isFinite(summary?.answered as number) ? Math.max(0, Math.round(summary!.answered)) : "–")}` , c: "--hud-purple" },
  ]), [summary]);

  const leveledUp = (summary?.commanderLevelPrev ?? summary?.commanderLevel ?? 0) < (summary?.commanderLevel ?? 0);
  // Compute unlocks newly gained this level-up using central catalog
  const unlocks: string[] = useMemo(() => {
    const prev = Number(summary?.commanderLevelPrev ?? (Number(summary?.commanderLevel ?? 0) - 1));
    const cur = Number(summary?.commanderLevel ?? 0);
    return getUnlocksNewBetween(prev, cur).map((u) => u.name);
  }, [summary?.commanderLevelPrev, summary?.commanderLevel]);

  // Fire confetti effect on level-up (lightweight CSS confetti)
  useEffect(() => {
    if (!leveledUp) return;
    try {
      // simple confetti using DOM particles to avoid new deps
      const n = 80;
      const root = document.createElement('div');
      root.style.position = 'fixed';
      root.style.inset = '0';
      root.style.pointerEvents = 'none';
      root.style.zIndex = '9999';
      for (let i = 0; i < n; i++) {
        const p = document.createElement('div');
        const size = 6 + Math.random() * 6;
        p.style.position = 'absolute';
        p.style.left = Math.round(Math.random() * 100) + '%';
        p.style.top = '-10px';
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.background = ['#4DA6FF','#34C759','#FF9F0A','#FF375F','#9D4EDD'][Math.floor(Math.random()*5)];
        p.style.opacity = '0.9';
        p.style.transform = `rotate(${Math.random()*360}deg)`;
        p.style.borderRadius = '1px';
        p.animate([
          { transform: `translateY(0) rotate(0deg)`, opacity: 1 },
          { transform: `translate(${(Math.random()-0.5)*200}px, ${window.innerHeight+50}px) rotate(${Math.random()*720}deg)`, opacity: 0.8 }
        ], { duration: 1800 + Math.random()*1000, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
        root.appendChild(p);
      }
      document.body.appendChild(root);
      setTimeout(() => { try { document.body.removeChild(root); } catch {} }, 2400);
    } catch {}
  }, [leveledUp]);

  // Load mission answers from localStorage quest state (last mission stored under quest:deckId). Fallback to xp event payload not implemented yet.
  useEffect(() => {
    if (deckId === null) return;
    try {
      const raw = localStorage.getItem(`quest:${deckId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { mission?: { answered?: MissionAnswer[]; cardOrder?: number[]; bloomLevel?: string } };
      const ans = Array.isArray(parsed?.mission?.answered) ? parsed.mission!.answered! : [];
      setAnswers(ans);
      // fetch cards for label display if not already
      (async () => {
        try {
          const cards = await cardsRepo.listByDeck(deckId);
          const map: Record<number, SimpleCardMeta> = {};
          for (const c of cards) {
            const anyCard = c as unknown as SimpleCardMeta;
            map[c.id] = { id: c.id, front: anyCard.front, back: anyCard.back, question: anyCard.question, prompt: anyCard.prompt, name: anyCard.name, explanation: anyCard.explanation, answer: anyCard.answer, suggestedAnswer: anyCard.suggestedAnswer };
          }
          setCardsById(map);
        } catch {}
      })();
    } catch {}
  }, [deckId]);

  // When modal opens, attempt to fetch authoritative per-card answers from API if we don't have them yet or only have empty array.
  useEffect(() => {
    if (!accuracyOpen || deckId === null) return;
    let ignore = false;
    (async () => {
      try {
        // Only fetch if missing or empty (so we still show local answers immediately if present)
        if (answers && answers.length > 0) return;
        const res = await fetch(`/api/quest/${deckId}/attempts/last-answers`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (ignore) return;
        if (data?.found && Array.isArray(data.answers)) {
          setAnswers(data.answers as MissionAnswer[]);
          // If we have cards but some missing, we can lazily refetch
          if (Object.keys(cardsById).length === 0) {
            try {
              const cards = await cardsRepo.listByDeck(deckId);
              if (ignore) return;
              const map: Record<number, SimpleCardMeta> = {};
              for (const c of cards) {
                const anyCard = c as unknown as SimpleCardMeta;
                map[c.id] = { id: c.id, front: anyCard.front, back: anyCard.back, question: anyCard.question, prompt: anyCard.prompt, name: anyCard.name, explanation: anyCard.explanation, answer: anyCard.answer, suggestedAnswer: anyCard.suggestedAnswer };
              }
              setCardsById(map);
            } catch {}
          }
        }
      } catch {}
    })();
    return () => { ignore = true; };
  }, [accuracyOpen, deckId, answers, cardsById]);

  return (
    <section className="lg:col-span-2 bg-[var(--secondary-color)]/90 backdrop-blur-sm rounded-xl p-6 md:p-8 shadow-sm border border-slate-200 relative h-full">
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--primary-color)]">Mission Complete</p>
      <p className="text-[var(--text-secondary)] text-lg">{summary?.modeLabel || (typeof summary?.modeLabel === "string" ? summary.modeLabel : "Quest")} — {summary?.deckTitle || "Your Latest Deck"}</p>
        </div>
        <div className="w-full md:w-auto">
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100} aria-label="Mission completion">
            <div className="h-full bg-[var(--primary-color)] rounded-full" style={{ width: "100%" }} />
          </div>
          <p className="text-xs text-center mt-1 text-[var(--text-secondary)]">100% Complete</p>
        </div>
      </header>
  <div className="flex flex-col items-center text-center my-8 md:my-12">
        <div className="relative w-36 h-36 mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--primary-color)]/20 animate-rotate-slow" />
          <div className="absolute inset-2 rounded-full border-2 border-[var(--primary-color)]/30 animate-rotate-slow" style={{ animationDirection: "reverse" }} />
          <div className="w-full h-full flex items-center justify-center animate-pulse-glow rounded-full bg-white">
            <svg className="w-20 h-20 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
        <h1 className="text-4xl font-bold">Agent, mission accomplished.</h1>
        <p className="text-lg text-[var(--text-secondary)] mt-2">You have successfully completed your objective.</p>
        {leveledUp && (
          <div className="mt-4 max-w-xl w-full rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm">
            <div className="font-semibold">Commander level up {Math.max(1, Number(summary?.commanderLevelPrev ?? (summary?.commanderLevel ?? 1) - 1))} → {Number(summary?.commanderLevel ?? 1)}</div>
            {unlocks.length > 0 && (
              <div className="mt-1">Unlocked — {unlocks.join(', ')}</div>
            )}
          </div>
        )}
      </div>
      {(() => {
        // Level Up customization: show mastery increase banner and bar when mode is levelup
        const mode = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mode") : null) || null;
        const lvlParam = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("level") : null) as DeckBloomLevel | null;
        if (mode === "levelup" && lvlParam) {
          // Fetch mastery delta lazily on client
          return <LevelUpMasteryResult deckId={deckId} level={lvlParam} />;
        }
        // Otherwise keep original pass/fail banners
        return (typeof summary?.accuracyPercent === "number") ? (() => {
          const pct = Math.max(0, Math.round(summary!.accuracyPercent));
          const pass = summary?.unlocked === true ? true : pct >= DEFAULT_QUEST_SETTINGS.passThreshold;
          const softPass = pass && pct < 75;
          if (softPass) return (
            <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 text-sm">
              Unlocked next Bloom. Strengthen weak spots in <a className="underline" href={deckId !== null ? `/decks/${deckId}/study` : "/decks"}>Target Practice</a> →
            </div>
          );
          if (!pass) return (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 text-red-900 px-4 py-3 text-sm">
              No unlock yet. Try <a className="underline" href={deckId !== null ? `/decks/${deckId}/study` : "/decks"}>Target Practice</a> or Level Up to build retention, then retry.
            </div>
          );
          return null;
        })() : null;
      })()}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(({ k, v, c, interactive }) => {
          const clickable = !!interactive;
          return (
            <button
              key={k}
              type="button"
              onClick={clickable ? () => setAccuracyOpen(true) : undefined}
              className={`rounded-lg p-4 border text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-color)] ${clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              style={{ backgroundColor: `color-mix(in srgb, var(${c}), white 90%)`, borderColor: `color-mix(in srgb, var(${c}), transparent 70%)` }}
              aria-label={clickable ? 'View accuracy details' : undefined}
            >
              <p className="text-sm font-semibold" style={{ color: `var(${c})` }}>{k}{clickable ? ' (details)' : ''}</p>
              <p className="text-2xl font-extrabold" style={{ color: `var(${c})` }}>{v}</p>
            </button>
          );
        })}
      </div>

      <AccuracyDetailsModal
        open={accuracyOpen}
        onClose={() => setAccuracyOpen(false)}
        answers={answers}
        cardsById={cardsById}
        accuracyPercent={summary?.accuracyPercent}
      />

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        {(() => {
          const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const mode = sp?.get("mode") || null;
          const lvl = sp?.get("level") || null;
          if (mode === "levelup" && lvl && deckId !== null) {
            return (
              <>
                <a
                  href={`/decks/${deckId}/levelup?level=${encodeURIComponent(lvl)}`}
                  className="bg-white text-[var(--text-primary)] border border-slate-300 rounded-lg px-6 py-3 font-semibold text-center hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-white transition-all duration-200"
                >
                  Retry
                </a>
                <a
                  href={`/decks/${deckId}/levelup/enter`}
                  className="bg-[var(--primary-color)] text-white rounded-lg px-6 py-3 font-semibold text-center hover:bg-[var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 focus:ring-offset-white transition-all duration-200 shadow-lg shadow-[var(--primary-color)]/15"
                >
                  Choose another level
                </a>
              </>
            );
          }
          return (
            <>
              <a
                href="/decks"
                className="bg-white text-[var(--text-primary)] border border-slate-300 rounded-lg px-6 py-3 font-semibold text-center hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-white transition-all duration-200"
              >
                Return to HQ
              </a>
              <a
                href={summary?.nextHref || (deckId !== null ? `/decks/${deckId}/quest` : "/decks")}
                className="bg-[var(--primary-color)] text-white rounded-lg px-6 py-3 font-semibold text-center hover:bg-[var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2 focus:ring-offset-white transition-all duration-200 shadow-lg shadow-[var(--primary-color)]/15"
              >
                Start Next Mission
              </a>
            </>
          );
        })()}
      </div>

      
    </section>
  );
}

async function loadSummary(deckId: number, modeParam: string | null, hints?: { unlockedParam?: string | null; pctParam?: string | null; levelParam?: string | null }): Promise<MissionSummary> {
  const supabase = getSupabaseClient();
  const [{ data: userData }, { data: eventsRes }, deckResp, progJson, apiSummary, lastFinalize] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("user_xp_events")
      .select("id, deck_id, bloom_level, event_type, payload, created_at")
      .eq("deck_id", deckId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("decks").select("title").eq("id", deckId).maybeSingle(),
    fetch(`/api/quest/${deckId}/progress`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`/api/quest/${deckId}/xp-events`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`/api/economy/last-finalize?deckId=${deckId}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  const user = userData?.user ?? null;
  type XpEvent = { id: number; deck_id: number; bloom_level: string; event_type: string; payload: unknown; created_at: string };
  const events = (eventsRes ?? []) as XpEvent[];

  const completedIdx = events.findIndex((e) => e.event_type === "mission_completed");
  const latestCompleted = completedIdx >= 0 ? events[completedIdx] : null;
  const tail = completedIdx >= 0 ? events.slice(completedIdx + 1) : [];
  const startedAfterIdx = tail.findIndex((e) => e.event_type === "mission_started");
  const started = startedAfterIdx >= 0 ? tail[startedAfterIdx] : null;
  const prevCompletedAfterIdx = tail.findIndex((e) => e.event_type === "mission_completed");
  const prevCompleted = prevCompletedAfterIdx >= 0 ? tail[prevCompletedAfterIdx] : null;

  let xpEarned = 0;
  let tokensEarned = 0;
  let accuracyPercent = 0;
  let answered = 0;
  let correctOut: number | undefined = undefined;
  let totalOut: number | undefined = undefined;
  const deckTitle: string = deckResp?.data?.title ? String(deckResp.data.title) : "";

  // Hints are consumed below; no additional placeholders needed
  if (lastFinalize?.found) {
    xpEarned = Number(lastFinalize.xpDelta ?? 0);
    tokensEarned = Number(lastFinalize.tokensDelta ?? 0);
  } else if (apiSummary?.found) {
    xpEarned = Number(apiSummary.xp_earned ?? 0);
    tokensEarned = 0; // No token data from apiSummary
    const total = Number(apiSummary.total ?? 0);
    const correct = Number(apiSummary.correct ?? 0);
    answered = Number.isFinite(total) ? total : 0;
  totalOut = answered;
  correctOut = Number.isFinite(correct) ? correct : 0;
  const pctFloat = total > 0 ? (correct / total) * 100 : 0;
  accuracyPercent = Math.round(pctFloat * 10) / 10;
  } else if (latestCompleted) {
    tokensEarned = 0; // No token telemetry for legacy events
    const endTime = new Date(latestCompleted.created_at).getTime();
    const postWindowMs = 30 * 1000; // include XP events up to 30s after completion
    const startTime = started
      ? new Date(started.created_at).getTime()
      : prevCompleted
      ? new Date(prevCompleted.created_at).getTime()
      : endTime - 6 * 60 * 60 * 1000; // fallback: last 6 hours
    for (const e of events) {
      const t = new Date(e.created_at).getTime();
      // Include XP events slightly after completion; others must be within [start, end]
      const withinWindow = t > startTime && t <= endTime;
      const isXp = e.event_type === "xp_bloom_added" || e.event_type === "xp_commander_added";
      const withinPost = isXp && t > endTime && t <= endTime + postWindowMs;
      if (!withinWindow && !withinPost) continue;
      if (isXp) {
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
    totalOut = answered;
    correctOut = Number.isFinite(correct) ? correct : 0;
    const pctFloat = total > 0 ? (correct / total) * 100 : 0;
    accuracyPercent = Math.round(pctFloat * 10) / 10;
  }

  // Override answered/accuracy from hints if present
  const pctHint = hints?.pctParam ? Number(hints.pctParam) : NaN;
  if (!Number.isNaN(pctHint)) accuracyPercent = Math.max(0, Math.min(100, Math.round(pctHint * 10) / 10));
  // answered hint from query string if present
  const totalHint = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("total")) ?? null;
  const correctHint = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("correct")) ?? null;
  const totalNum = totalHint ? Number(totalHint) : NaN;
  const correctNum = correctHint ? Number(correctHint) : NaN;
  if (!Number.isNaN(totalNum)) answered = Math.max(0, Math.round(totalNum));
  if (!Number.isNaN(totalNum) && !Number.isNaN(correctNum) && totalNum > 0) {
    totalOut = totalNum;
    correctOut = correctNum;
    accuracyPercent = Math.round(((correctNum / totalNum) * 100) * 10) / 10;
  }

  // If caller provided an explicit pct, prefer it
  const pctFromParam = hints?.pctParam ? Number(hints.pctParam) : NaN;
  if (!Number.isNaN(pctFromParam)) accuracyPercent = Math.max(0, Math.min(100, Math.round(pctFromParam * 10) / 10));

  // If we didn't find xp events (new mode or race), fallback XP from correct answers for this mission
  if (!(apiSummary?.found) && xpEarned <= 0 && typeof correctOut === "number" && correctOut >= 0) {
    xpEarned = XP_MODEL.awardForMission({ correct: correctOut, total: Number(totalOut ?? 0), bloom: "Remember" });
  }

  // Fetch wallet for commander XP + tokens; fall back to quest aggregates
  let walletCommanderXp = 0;
  let walletTokens = 0;
  try {
    const wallet = await fetch(`/api/economy/wallet`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (wallet) {
      walletCommanderXp = Number(wallet.commander_xp ?? 0);
      walletTokens = Number(wallet.tokens ?? 0);
    }
  } catch {}
    const commanderXpTotal = walletCommanderXp || (progJson && typeof progJson.xp?.commanderXpTotal === "number" ? progJson.xp.commanderXpTotal : 0);
    // Estimate previous level from XP before mission: subtract this mission's commander XP (approx) if present
    // We don't have per-mission commander XP split; infer from xpEarned (commander XP ~= xpEarned for simplicity)
    const prevXpTotal = Math.max(0, commanderXpTotal - Math.max(0, Math.round(xpEarned)));
  const commanderLevelPrev = XP_MODEL.progressFor(prevXpTotal).level;
  const commanderLevel = XP_MODEL.progressFor(commanderXpTotal).level;
  // tokensEarned shows this-mission tokens; now calculated from new token system
  // tokensEarned is already set above from lastFinalize.tokensDelta

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "Agent";
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) || (user?.user_metadata?.picture as string | undefined) || null;

  let modeLabel = "Quest";
  if (modeParam) modeLabel = modeParam === "topics" ? "Topic Trek" : modeParam === "timed" ? "Timed Drill" : modeParam === "boost" ? "Boost" : modeParam === "remix" ? "Random Remix" : modeParam === "starred" ? "Starred" : modeParam === "levelup" ? "Level Up" : "Quest";

  // Compute the next mission href using the same logic as quest enter unlocks
  let nextHref: string | null = null;
  // Determine unlocked from param first, then fallback to per_bloom[level].cleared
  let unlocked: boolean | undefined = undefined;
  try {
    const fromParam = hints?.unlockedParam ? (hints.unlockedParam === "1" || String(hints.unlockedParam).toLowerCase() === "true") : null;
    if (fromParam === true) unlocked = true;
  } catch {}
  try {
  type PB = Partial<Record<DeckBloomLevel, { mastered?: boolean; totalCards?: number; missionsCompleted?: number; missionsPassed?: number; accuracySum?: number; accuracyCount?: number; cleared?: boolean }>>;
    const perBloom: PB = progJson && typeof progJson === "object" && (progJson as { per_bloom?: PB }).per_bloom ? (progJson as { per_bloom?: PB }).per_bloom! : {};
    if (unlocked !== true && hints?.levelParam) {
      const lvl = (hints.levelParam as DeckBloomLevel);
      const prev = perBloom[lvl];
      if (prev?.cleared) unlocked = true;
    }
    const cap = DEFAULT_QUEST_SETTINGS.missionCap;
    const passThreshold = DEFAULT_QUEST_SETTINGS.passThreshold;
    type LevelInfo = { level: DeckBloomLevel; totalCards: number; missionsCompleted: number; missionsPassed: number; totalMissions: number; mastered: boolean; unlocked: boolean };
    const levels: LevelInfo[] = (BLOOM_LEVELS as DeckBloomLevel[]).map((lvl) => {
  const p = perBloom[lvl] || {};
      const totalCards = Number(p.totalCards ?? 0);
  const missionsCompleted = Number(p.missionsCompleted ?? 0);
  const missionsPassed = Number(p.missionsPassed ?? missionsCompleted);
      const totalMissions = Math.ceil(totalCards / cap) || 0;
      const mastered = !!p.mastered;
      return { level: lvl, totalCards, missionsCompleted, missionsPassed, totalMissions, mastered, unlocked: false };
    });
    // unlocks: Remember always; others unlocked if previous mastered OR cleared (fallback: avg accuracy >= threshold with >=1 mission)
    for (let i = 0; i < levels.length; i++) {
      if (i === 0) { levels[i]!.unlocked = true; continue; }
      const prevLvl = levels[i - 1]!.level;
      const prev = perBloom[prevLvl];
      const prevMastered = !!prev?.mastered;
      const prevCleared = !!prev?.cleared;
      let fallbackUnlock = false;
      if (!prevCleared) {
        const prevAvg = prev && (prev.accuracyCount ?? 0) > 0 ? Math.round(((prev.accuracySum ?? 0) / Math.max(1, prev.accuracyCount ?? 0)) * 100) : 0;
        const prevHasMission = (prev?.missionsCompleted ?? 0) > 0;
        fallbackUnlock = prevHasMission && prevAvg >= passThreshold;
      }
      levels[i]!.unlocked = prevMastered || prevCleared || fallbackUnlock;
    }
    // choose next actionable: first unlocked level with remaining missions and has >0 missions
    // Use missionsPassed to determine remaining missions for gating
  const candidate = levels.find((li) => li.unlocked && li.totalMissions > 0 && li.missionsPassed < li.totalMissions)
      // if none, optionally allow restart of the earliest unlocked level with missions
      ?? levels.find((li) => li.unlocked && li.totalMissions > 0);
    if (candidate) {
      const needsRestart = candidate.missionsCompleted >= candidate.totalMissions;
      const qs = needsRestart ? `&restart=1` : ``;
      nextHref = `/decks/${deckId}/quest?level=${encodeURIComponent(candidate.level)}${qs}`;
    }
    else nextHref = `/decks/${deckId}/quest`;
  } catch {
    nextHref = `/decks/${deckId}/quest`;
  }

  return {
    deckId,
    deckTitle,
    modeLabel,
    accuracyPercent,
  correct: correctOut,
  total: totalOut,
    answered,
    xpEarned,
  tokensEarned,
  tokensBalance: walletTokens,
    commanderLevel,
  commanderLevelPrev,
  user: user ? { name: displayName, avatarUrl } : null,
  nextHref,
  unlocked,
  perBloomRaw: progJson?.per_bloom ?? null,
  };
}
