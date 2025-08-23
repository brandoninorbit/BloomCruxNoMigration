/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
// src/components/DashboardClient.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import Link from "next/link";
import {
  Award,
  ChevronDown,
  LineChart,
  BookOpen,
  User,
  TrendingUp,
  AlertCircle,
  Zap,
  Star,
} from "lucide-react";
import { gradientForBloom, BLOOM_LEVELS, BLOOM_COLOR_HEX } from "@/types/card-catalog";
import type { DeckBloomLevel } from "@/types/deck-cards";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn, formatPercent1 } from "@/lib/utils";
import AgentCard from "./AgentCard";
import { getSupabaseClient } from "@/lib/supabase/browserClient";
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import DashboardProgressChart from "@/components/DashboardProgressChart";
import Image from "next/image";
import { commanderLevel as commanderLevelCalc } from "@/lib/xp";
import DeckProgressChart from "@/components/decks/DeckProgressChart";

// Helper component for Progress Ring
const ProgressRing = ({
  value,
  maxValue,
  className,
  strokeWidth = 10,
  size = 120,
}: {
  value: number;
  maxValue: number;
  className?: string;
  strokeWidth?: number;
  size?: number;
}) => {
  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / maxValue) * circumference;

  return (
    <svg className="w-full h-full" viewBox="0 0 120 120">
      <circle
        className="text-gray-200"
        cx="60"
        cy="60"
        fill="transparent"
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
      ></circle>
      <circle
        className={cn("progress-ring", className)}
        cx="60"
        cy="60"
        fill="transparent"
        r={radius}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        style={{
          strokeDasharray: circumference,
          strokeDashoffset: offset,
          transition: "stroke-dashoffset 0.35s",
          transform: "rotate(-90deg)",
          transformOrigin: "50% 50%",
        }}
      ></circle>
    </svg>
  );
};

// Types and mock data
type BloomLevel =
  | "Remember"
  | "Understand"
  | "Apply"
  | "Analyze"
  | "Evaluate"
  | "Create";

type DeckProgress = {
  deckId: string;
  deckName: string;
  totalCards: number;
  lastStudied: Date;
  isMastered: boolean;
  level: number;
  xp: number;
  xpToNext: number;
  // For progress bars (percent-style), keep existing stored mastery percent as 0..100 out of 100
  bloomMastery: Partial<Record<BloomLevel, { correct: number; total: number }>>;
  // For attempts aggregation in the dashboard window
  bloomAttempts?: Partial<Record<BloomLevel, { correct: number; total: number }>>;
};

type GlobalProgress = { level: number; xp: number; xpToNext: number };
type UserXpStats = {
  sessionXP: number;
  dailyXP: number;
  bonusVault: number;
  isXpBoosted: boolean;
};
type UserSettings = { displayName: string; tokens: number };
type DeckRow = { id: number; title: string | null };
type MasteryRow = {
  deck_id: number;
  bloom_level: BloomLevel | string;
  mastery_pct: number | null;
  updated_at?: string;
};

const MOCK_GLOBAL_PROGRESS: GlobalProgress = {
  level: 5,
  xp: 250,
  xpToNext: 1000,
};
const MOCK_SETTINGS: UserSettings = { displayName: "Mock User", tokens: 1250 };
const MOCK_DECK_PROGRESS: DeckProgress[] = [
  {
    deckId: "mock1",
    deckName: "Cellular Respiration",
    totalCards: 25,
    lastStudied: new Date(),
    isMastered: false,
    level: 3,
    xp: 40,
    xpToNext: 150,
    bloomMastery: {
      Remember: { correct: 8, total: 10 },
      Understand: { correct: 5, total: 7 },
    },
  },
  {
    deckId: "mock2",
    deckName: "Photosynthesis",
    totalCards: 30,
    lastStudied: new Date(),
    isMastered: true,
    level: 5,
    xp: 110,
    xpToNext: 200,
    bloomMastery: {
      Remember: { correct: 10, total: 10 },
      Understand: { correct: 9, total: 10 },
      Apply: { correct: 8, total: 10 },
    },
  },
];
const MOCK_XP_STATS: UserXpStats = {
  sessionXP: 120,
  dailyXP: 650,
  bonusVault: 50,
  isXpBoosted: true,
};

export default function DashboardClient() {
  const { user } = useAuth();
  // Default to real data for logged-in users, mock data if logged out
  const [showExample, setShowExample] = useState(!user);
  const [realDecks, setRealDecks] = useState<DeckProgress[]>([]);
  const [userTokens, setUserTokens] = useState<number>(0);
  const [commanderXpTotal, setCommanderXpTotal] = useState<number>(0);
  const [attemptsHistory, setAttemptsHistory] = useState<Array<{ at: string; acc: number }>>([]);

  // Load real mastery when logged in and not showing example
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || showExample) {
        setRealDecks([]);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        // Fetch user's decks, mastery, quest xp, and recent attempts (last 30 days) in parallel
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: decks }, { data: mastery }, { data: quest }, { data: attempts }] = await Promise.all([
          supabase.from("decks").select("id, title").order("created_at", { ascending: false }),
          supabase
            .from("user_deck_bloom_mastery")
            .select("deck_id, bloom_level, mastery_pct")
            .order("updated_at", { ascending: false }),
          supabase
            .from("user_deck_quest_progress")
            .select("deck_id, xp")
            .order("updated_at", { ascending: false }),
          supabase
            .from("user_deck_mission_attempts")
            .select("deck_id, bloom_level, score_pct, cards_seen, cards_correct, ended_at")
            .gte("ended_at", cutoff)
            .order("ended_at", { ascending: false }),
        ]);

        if (cancelled) return;

  const byDeck: Record<string, DeckProgress> = {};
  const deckRows = (decks ?? []) as DeckRow[];
  deckRows.forEach((d) => {
          const id = Number(d.id);
          byDeck[id] = {
            deckId: String(id),
            deckName: String(d.title ?? "Untitled Deck"),
            totalCards: 0,
            lastStudied: new Date(),
            isMastered: false,
            level: 1,
            xp: 0,
            xpToNext: 100,
            bloomMastery: {},
          } as DeckProgress;
        });

  const masteryRows = (mastery ?? []) as MasteryRow[];
  masteryRows.forEach((row) => {
          const deckId = String(row.deck_id);
          const level = String(row.bloom_level) as BloomLevel;
          const pct = Number(row.mastery_pct ?? 0);
          if (!byDeck[deckId]) return; // skip unrelated rows
          // Store as correct/total with total=100 so UI math yields pct
          byDeck[deckId].bloomMastery[level] = { correct: Math.max(0, Math.min(100, pct)), total: 100 };
        });

        // Aggregate attempts for the window: sum of cards_correct and cards_seen per deck/bloom
        type AttemptRow = { deck_id: number; bloom_level: BloomLevel | string | null; score_pct: number | null; cards_seen: number | null; cards_correct: number | null; ended_at?: string | null };
        const attRows = (attempts ?? []) as AttemptRow[];
        const hist: Array<{ at: string; acc: number }> = [];
        for (const r of attRows) {
          const deckId = String(r.deck_id);
          const lvl = String(r.bloom_level ?? "Remember") as BloomLevel;
          if (byDeck[deckId]) {
            const cur = (byDeck[deckId].bloomAttempts ?? {}) as NonNullable<DeckProgress["bloomAttempts"]>;
            const prev = cur[lvl] ?? { correct: 0, total: 0 };
            const c = Number(r.cards_correct ?? 0);
            const t = Number(r.cards_seen ?? 0);
            cur[lvl] = { correct: prev.correct + c, total: prev.total + t };
            byDeck[deckId].bloomAttempts = cur;
          }
          const t = Math.max(0, Number(r.cards_seen ?? 0));
          const c = Math.max(0, Number(r.cards_correct ?? 0));
          const acc = t > 0 ? c / t : 0;
          const atIso = r.ended_at ?? new Date().toISOString();
          hist.push({ at: atIso, acc });
        }
        // sort ascending by time for chart
        hist.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
        setAttemptsHistory(hist);

        // Compute deck-level isMastered by averaging available blooms
        Object.values(byDeck).forEach((deck) => {
          const vals = Object.values(deck.bloomMastery).filter(Boolean);
          const avg = vals.length
            ? (vals.reduce((acc, v) => acc + (v!.correct / Math.max(1, v!.total)), 0) / vals.length) * 100
            : 0;
          deck.isMastered = avg >= 80;
        });

        setRealDecks(Object.values(byDeck));

        // Load wallet tokens and commander XP from server API
        try {
          const wallet = await fetch(`/api/economy/wallet`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
          if (wallet) {
            const tokens = Math.max(0, Number(wallet.tokens ?? 0));
            const cxp = Math.max(0, Number(wallet.commander_xp ?? 0));
            setUserTokens(Math.round(tokens));
            setCommanderXpTotal(cxp);
          }
        } catch {}
      } catch (err) {
        // Silent fail to avoid blocking dashboard
        setRealDecks([]);
        // console.warn('[Dashboard] mastery load error:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, showExample]);

  const progressToDisplay = useMemo<DeckProgress[]>(
    () => (showExample ? MOCK_DECK_PROGRESS : realDecks),
    [showExample, realDecks]
  );
  const globalProgress = useMemo<GlobalProgress>(() => {
    if (showExample) return MOCK_GLOBAL_PROGRESS;
    const lvl = commanderLevelCalc(commanderXpTotal);
    return { level: lvl.level, xp: lvl.xpIntoLevel, xpToNext: lvl.xpToNext };
  }, [showExample, commanderXpTotal]);
  // Derive simple tokens from commander XP total (1:1) for now
  const userSettings = useMemo<UserSettings>(
    () => (showExample ? MOCK_SETTINGS : { displayName: 'Agent', tokens: userTokens }),
    [showExample, userTokens]
  );
  const xpStats = useMemo<UserXpStats>(
    () =>
      showExample
        ? MOCK_XP_STATS
        : { sessionXP: 0, dailyXP: 0, bonusVault: 0, isXpBoosted: false },
    [showExample]
  );

  const overallStats = useMemo(() => {
    let totalReviewed = 0;
    let masteredDecks = 0;
    for (const deck of progressToDisplay) {
      if (deck.isMastered) masteredDecks++;
      Object.values(deck.bloomMastery).forEach((lvl) => {
        if (lvl) totalReviewed += lvl.total;
      });
    }
    return { reviewed: totalReviewed, masteredDecks };
  }, [progressToDisplay]);

  const [smaOpen, setSmaOpen] = useState(false);

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Commander Debriefing
          </h1>
          <button
            onClick={() => setShowExample((v) => !v)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {showExample ? "Hide Example" : "Show Example"}
          </button>
        </div>
        <p className="text-gray-600 mb-6">
          Review your overall performance and deck-specific mastery levels.
        </p>

        {showExample && (
          <>
            <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-4 mb-4 rounded-r-lg">
              <div className="flex items-center">
                <AlertCircle className="mr-3" />
                <div>
                  <p className="font-bold">Viewing Mock Data</p>
                  <p className="text-sm">
                    This is a synthetic mock dashboard. Click “Hide Example” to
                    see your real progress.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 mb-4 rounded-r-lg">
              <div className="flex items-center">
                <Star className="mr-3" />
                <div>
                  <p className="font-bold">Bonus Vault Ready!</p>
                  <p className="text-sm">
                    New bonus XP is waiting for tomorrow!
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-indigo-50 border-l-4 border-indigo-500 text-indigo-800 p-4 mb-6 rounded-r-lg">
              <div className="flex items-center">
                <Zap className="mr-3" />
                <div>
                  <p className="font-bold">2x XP Booster Active!</p>
                  <p className="text-sm">
                    All XP gains in your transit session are doubled!
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Commander Overview
          </h2>
          <div
            className="bg-white p-6 rounded-2xl shadow-sm"
            style={{ minHeight: "28rem" }}
          >
            <div className="grid grid-cols-3 gap-6 h-full">
              <div className="flex flex-col justify-center items-center">
                <div className="flex items-center justify-center space-x-[-3rem]">
                    <div className="relative w-48 h-48">
                    <ProgressRing
                        value={globalProgress.xp}
                        maxValue={globalProgress.xpToNext}
                        className="text-blue-500"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900">
                        {globalProgress.xp}
                        </span>
                        <span className="text-sm text-gray-500">
                        / {globalProgress.xpToNext} XP
                        </span>
                    </div>
                    </div>
                    <div className="flex flex-col items-center">
                    <div className="relative w-32 h-32">
                        <ProgressRing
                        value={xpStats.sessionXP}
                        maxValue={850} // Assuming max daily is 850
                        className="text-orange-500"
                        strokeWidth={8}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold text-gray-900">
                            {xpStats.sessionXP}
                        </span>
                        <span className="text-xs text-gray-500">Session XP</span>
                        </div>
                    </div>
                    <div className="relative w-24 h-24 mt-2">
                        <ProgressRing
                        value={xpStats.dailyXP}
                        maxValue={850} // Assuming max daily is 850
                        className="text-teal-500"
                        strokeWidth={8}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-md font-bold text-gray-900">
                            {xpStats.dailyXP}
                        </span>
                        <span className="text-xs text-gray-500">Daily XP</span>
                        </div>
                    </div>
                    </div>
                </div>
              </div>
              <div className="flex flex-col space-y-4 justify-center">
                <div className="bg-gray-100 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      Total Cards Reviewed
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {overallStats.reviewed}
                    </p>
                  </div>
                  <BookOpen className="text-gray-400 text-3xl" />
                </div>
                <div className="bg-gray-100 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Decks Mastered</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {overallStats.masteredDecks}
                    </p>
                  </div>
                  <Award className="text-gray-400 text-3xl" />
                </div>
              </div>
              <div className="flex items-center justify-center">
                {(() => {
                  const first = (user?.user_metadata?.full_name || "").trim().split(/\s+/)[0] || (user?.email?.split("@")[0] ?? userSettings.displayName);
                  const avatar = (user?.user_metadata?.avatar_url as string | undefined) || (user?.user_metadata?.picture as string | undefined) || undefined;
                  return (
                    <AgentCard
                      displayName={first}
                      level={globalProgress.level}
                      tokens={userSettings.tokens}
                      avatarUrl={avatar}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Deck Dossiers
          </h2>
          <p className="text-gray-600 mb-6">
            Select a deck to continue your training.
          </p>
          <div className="space-y-4">
            {progressToDisplay.map((deck) => (
              <Collapsible
                key={deck.deckId}
                className="group bg-white p-6 rounded-2xl shadow-sm"
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 text-left">
                        {deck.deckName}
                      </h3>
                      <p className="text-sm text-gray-500 text-left">
                        Mastery: {" "}
                        {(() => {
                          // Exclude Create level from the aggregate mastery percent
                          const entries = Object.entries(deck.bloomMastery).filter(([lvl]) => (lvl as BloomLevel) !== "Create");
                          const sumCorrect = entries.reduce((acc, [, curr]) => acc + curr.correct, 0);
                          const sumTotal = entries.reduce((acc, [, curr]) => acc + curr.total, 0);
                          const pct = sumTotal > 0 ? (sumCorrect / sumTotal) * 100 : 0;
                          return formatPercent1(pct);
                        })()} | {deck.xp}/{deck.xpToNext} XP
                      </p>
                    </div>
                    <div className="flex items-center flex-shrink-0">
                      {deck.isMastered && (
                        <Award className="text-yellow-500 mr-2" />
                      )}
                      <ChevronDown className="text-gray-400 cursor-pointer transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 mt-4">
                    {/* Render blooms in defined order (easiest -> hardest) */}
                    {(BLOOM_LEVELS as BloomLevel[]).map((level) => {
                      const mastery = deck.bloomMastery[level];
                      if (!mastery) return null;
                      const percentage = mastery.total > 0 ? (mastery.correct / mastery.total) * 100 : 0;
                      const grad = gradientForBloom(level as DeckBloomLevel);
                      if (level === "Create") {
                        return (
                          <div key={level} className="flex items-center mb-2 group">
                            <span className="text-sm font-medium text-gray-600 w-24 relative -top-[2px]">Create</span>
                            <div className="text-xs ml-2" style={{ color: BLOOM_COLOR_HEX["Create"] }}>Coming soon</div>
                          </div>
                        );
                      }
                      return (
                        <div key={level} className="flex items-center mb-2 group">
                          <span className="text-sm font-medium text-gray-600 w-24 relative -top-[2px]">
                            {level}
                          </span>

                          <div className="relative w-full">
                            {/* progress bar background */}
                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="h-2.5 rounded-full"
                                style={{ width: `${percentage}%`, background: grad }}
                              />
                            </div>

                            {/* GoldMedal badge sticks onto left/top of the progress bar when mastered */}
                            {percentage >= 80 && (
                              <>
                                <div className="absolute left-0 -top-4 transition-transform duration-200 transform group-hover:scale-125" aria-hidden style={{ transform: 'translateX(-50%)' }}>
                                  <Image src="/icons/GoldMedal.svg" alt="Mastered" width={28} height={28} />
                                </div>
                                <span
                                  className="absolute left-8 -top-1 opacity-0 group-hover:opacity-100 transform transition-all duration-200 rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-sm"
                                  style={{ background: grad }}
                                >
                                  MASTERED
                                </span>
                              </>
                            )}
                          </div>

                          <span className="text-sm font-medium text-gray-600 ml-3">
                            {formatPercent1(percentage)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Secondary line: show Correct / Total attempts aggregate for this dashboard window */}
                  <div className="mt-2 space-y-1">
                    {(BLOOM_LEVELS as BloomLevel[]).map((level) => {
                      const agg = deck.bloomAttempts?.[level];
                      if (!agg) return null;
                      const c = Math.max(0, Math.round(agg.correct));
                      const t = Math.max(0, Math.round(agg.total));
                      return (
                        <div key={`ct-${level}`} className="flex items-center text-xs text-gray-500">
                          <span className="w-24" />
                          <span className="ml-0.5">{c} / {t}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Per-deck 30-day trend chart: X=attempt index, Y=score_pct, blue raw + green SMA(5) */}
                  <div className="mt-4 relative">
                    <div className="absolute right-0 -top-8">
                      <button onClick={() => setSmaOpen(true)} className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 border border-gray-200 hover:bg-gray-200">What is SMA?</button>
                    </div>
                    <DeckProgressChart deckId={Number(deck.deckId)} height={150} />
                  </div>
                  {/* Gentle banner if any non-Create mastery < 80 after updates (non-punitive) */}
                  {(() => {
                    try {
                      const entries = Object.entries(deck.bloomMastery || {}).filter(([lvl]) => (lvl as any) !== "Create");
                      const percents = entries.map(([, v]: any) => {
                        const pct = (v?.total ?? 0) > 0 ? (v.correct / v.total) * 100 : 0;
                        return Math.round(pct);
                      });
                      const minPct = percents.length ? Math.min(...percents) : 100;
                      if (minPct > 0 && minPct < 80) {
                        return (
                          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-amber-800 text-sm">
                            Mastery needs refresh (now {minPct}%). Replay to reinforce.
                          </div>
                        );
                      }
                    } catch {}
                    return null;
                  })()}
                  <div className="flex justify-end items-center mt-4 space-x-4">
                    <button className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center">
                      <TrendingUp className="text-sm mr-1" />
                      Level Up
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold">
                      Continue Study
                    </button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 font-mono">
                -- Agent Classified --
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Progress Over Time
            </h2>
            {/* Fallback visible help button so "What is SMA?" is reachable on all layouts */}
            <div className="ml-4">
              <button
                onClick={() => setSmaOpen(true)}
                className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 border border-gray-200 hover:bg-gray-200"
                aria-label="What is SMA? Open help"
              >
                What is SMA?
              </button>
            </div>
          </div>
          <p className="text-gray-600 mb-6">
            Your last 30 days of mission accuracy. Values are floats; axis labels show percent.
          </p>
          <div className="bg-white p-6 rounded-2xl shadow-sm h-64 relative">
            <div className="absolute right-4 top-4">
              <button onClick={() => setSmaOpen(true)} className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 border border-gray-200 hover:bg-gray-200">What is SMA?</button>
            </div>
            <DashboardProgressChart showSMAOnly={true} />
          </div>
        </section>
        <Dialog open={smaOpen} onOpenChange={setSmaOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>What is SMA?</DialogTitle>
              <DialogDescription>
                SMA (Simple Moving Average) smooths recent mission accuracy to highlight trends over time.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-3 text-sm text-gray-700">
              <p>
                We plot your raw accuracy and a short-window SMA to make direction-of-change easier to see.
              </p>
              <div>
                <p className="font-semibold mb-1">When to look at which</p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Blue (Accuracy):</strong> “How did I do on that specific run?”</li>
                  <li><strong>Green (SMA):</strong> “Am I generally getting better or worse lately?” (It lags a little by design.)</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
