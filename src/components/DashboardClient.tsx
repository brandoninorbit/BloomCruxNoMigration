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
import { resolveUserDisplay } from "@/lib/userProfile";
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
import { XP_MODEL } from "@/lib/xp";
import DeckProgressChart from "@/components/decks/DeckProgressChart";
import AccuracyDetailsModal, { type MissionAnswer } from "@/components/AccuracyDetailsModal";
import * as cardsRepo from "@/lib/cardsRepo";

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
  reviewedCount?: number;
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

type GlobalProgress = { level: number; xpIntoLevel: number; xpForLevel: number; xpToNext: number };
type UserXpStats = {
  sessionXP: number;
  dailyXP: number;
  bonusVault: number;
  isXpBoosted: boolean;
};
type UserSettings = { displayName: string; tokens: number };
type DeckRow = { id: number; title: string | null; folder_id?: number | null };
type FolderRow = { id: number; name: string | null; color: string | null };
type FolderUI = {
  id: number;
  name: string;
  colorName: string;
  colorClass: string;
  iconBgClass: string;
};
type MasteryRow = {
  deck_id: number;
  bloom_level: BloomLevel | string;
  mastery_pct: number | null;
  correctness_ewma?: number | null;
  retention_strength?: number | null; // 0..1
  coverage?: number | null; // 0..1
  updated_at?: string;
};

const MOCK_GLOBAL_PROGRESS: GlobalProgress = { level: 5, xpIntoLevel: 250, xpForLevel: 1000, xpToNext: 750 };
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
  const [decks, setDecks] = useState<DeckRow[]>([]);
  const [folders, setFolders] = useState<FolderUI[]>([]);
  const [userTokens, setUserTokens] = useState<number>(0);
  const [commanderXpTotal, setCommanderXpTotal] = useState<number>(0);
  const [attemptsHistory, setAttemptsHistory] = useState<Array<{ at: string; acc: number }>>([]);
  const [explainerOpen, setExplainerOpen] = useState<{ deckId: number; level: BloomLevel } | null>(null);
  const [explainerData, setExplainerData] = useState<{
    rows: Array<{ at: string; mode?: string | null; acc: number; seen: number; correct: number }>;
  factors?: { retentionPct: number; awaPct: number; masteryPct: number; coverageSeen?: number; coverageTotal?: number };
    note?: string;
  } | null>(null);
  const [masteryRows, setMasteryRows] = useState<MasteryRow[]>([]);
  // Per-attempt accuracy modal (new)
  const [accuracyOpen, setAccuracyOpen] = useState(false);
  const [accuracyLoading, setAccuracyLoading] = useState(false);
  const [accuracyAnswers, setAccuracyAnswers] = useState<MissionAnswer[] | null>(null);
  const [accuracyPct, setAccuracyPct] = useState<number | undefined>(undefined);
  const [selectedAttempt, setSelectedAttempt] = useState<{ deckId: number; attemptId: number } | null>(null);
  const [cardsByDeck, setCardsByDeck] = useState<Record<number, Record<number, { id: number; [k: string]: unknown }>>>({});
  const [deckAttempts, setDeckAttempts] = useState<Record<number, Array<{ id: number; acc: number; ended_at: string; mode?: string | null }>>>({});
  // Cache of answers per attempt to prevent refetching when user re-opens the modal for the same attempt
  const [attemptAnswersCache, setAttemptAnswersCache] = useState<Record<number, Record<number, MissionAnswer[]>>>({});

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
  // Fetch user's decks, quest xp, and recent attempts (last 90 days) in parallel
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: decks }, { data: foldersData }, { data: mastery }, { data: quest }, { data: attempts }] = await Promise.all([
          supabase.from("decks").select("id, title, folder_id").order("created_at", { ascending: false }),
          supabase.from("folders").select("id, name, color").order("created_at", { ascending: false }),
    // Keep mastery in case we need a fallback for decks with zero attempts in window
    supabase
      .from("user_deck_bloom_mastery")
      .select("deck_id, bloom_level, mastery_pct, correctness_ewma, retention_strength, coverage, updated_at")
      .order("updated_at", { ascending: false }),
          supabase
            .from("user_deck_quest_progress")
            .select("deck_id, xp")
            .order("updated_at", { ascending: false }),
          supabase
            .from("user_deck_mission_attempts")
            .select("id, deck_id, bloom_level, score_pct, cards_seen, cards_correct, ended_at, mode, breakdown")
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

  setDecks(deckRows);

  // Process folders
  const folderRows = (foldersData ?? []) as FolderRow[];
  const processedFolders: FolderUI[] = folderRows.map((r) => {
    const colorNames = ["blue", "green", "yellow", "purple", "pink", "orange", "gray"];
    const safeColor = colorNames.includes(String(r.color)) ? String(r.color) : "blue";
    const colorMap: Record<string, { text: string; bg: string }> = {
      blue: { text: "text-blue-500", bg: "bg-blue-100" },
      green: { text: "text-green-500", bg: "bg-green-100" },
      yellow: { text: "text-yellow-500", bg: "bg-yellow-100" },
      purple: { text: "text-purple-500", bg: "bg-purple-100" },
      pink: { text: "text-pink-500", bg: "bg-pink-100" },
      orange: { text: "text-orange-500", bg: "bg-orange-100" },
      gray: { text: "text-gray-500", bg: "bg-gray-200" },
    };
    return {
      id: Number(r.id),
      name: String(r.name ?? ""),
      colorName: safeColor,
      colorClass: colorMap[safeColor].text,
      iconBgClass: colorMap[safeColor].bg,
    };
  });
  setFolders(processedFolders);

  const masteryRowsLocal = (mastery ?? []) as MasteryRow[];
  setMasteryRows(masteryRowsLocal);

        // Aggregate attempts for the window: sum of cards_correct and cards_seen per deck/bloom
  type AttemptRow = { id?: number; deck_id: number; bloom_level: BloomLevel | string | null; score_pct: number | null; cards_seen: number | null; cards_correct: number | null; ended_at?: string | null; mode?: string | null; breakdown?: Record<string, { scorePct: number; cardsSeen: number; cardsCorrect: number }> | null };
        const attRows = (attempts ?? []) as AttemptRow[];
        const hist: Array<{ at: string; acc: number }> = [];
  const perDeckAttempts: Record<number, Array<{ id: number; acc: number; ended_at: string; mode?: string | null }>> = {};
        for (const r of attRows) {
          const deckId = String(r.deck_id);
          const cur = byDeck[deckId] ? ((byDeck[deckId].bloomAttempts ?? {}) as NonNullable<DeckProgress["bloomAttempts"]>) : null;
          // If breakdown present, split contributions per bloom; else attribute to row.bloom_level
          const b = r.breakdown && typeof r.breakdown === 'object' ? (r.breakdown as Record<string, { scorePct: number; cardsSeen: number; cardsCorrect: number }>) : null;
          if (cur) {
            if (b) {
              for (const key of Object.keys(b)) {
                const lvl = String(key) as BloomLevel;
                const part = b[key]!;
                const prev = cur[lvl] ?? { correct: 0, total: 0 };
                const cc = Math.max(0, Number(part.cardsCorrect ?? 0));
                const tt = Math.max(0, Number(part.cardsSeen ?? 0));
                cur[lvl] = { correct: prev.correct + cc, total: prev.total + tt };
              }
            } else {
              const lvl = String(r.bloom_level ?? "Remember") as BloomLevel;
              const prev = cur[lvl] ?? { correct: 0, total: 0 };
              const c = Number(r.cards_correct ?? 0);
              const t = Number(r.cards_seen ?? 0);
              cur[lvl] = { correct: prev.correct + c, total: prev.total + t };
            }
            byDeck[deckId]!.bloomAttempts = cur;
          }
          const t = Math.max(0, Number(r.cards_seen ?? 0));
          const c = Math.max(0, Number(r.cards_correct ?? 0));
          const acc = t > 0 ? c / t : 0;
          const atIso = r.ended_at ?? new Date().toISOString();
          hist.push({ at: atIso, acc });
          const did = Number(r.deck_id);
          if (!perDeckAttempts[did]) perDeckAttempts[did] = [];
          if (typeof r.id === 'number') {
            perDeckAttempts[did].push({ id: r.id, acc: Math.max(0, Math.min(100, Number(r.score_pct ?? (acc * 100)))), ended_at: atIso, mode: r.mode ?? null });
          }
        }
        // sort ascending by time for chart
        hist.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
        setAttemptsHistory(hist);
        // sort per-deck attempts (newest first) and keep at most 8 for UI brevity
        const limited: typeof perDeckAttempts = {};
        Object.keys(perDeckAttempts).forEach((k) => {
          const arr = perDeckAttempts[Number(k)].sort((a,b)=> new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime());
          limited[Number(k)] = arr.slice(0, 8);
        });
        setDeckAttempts(limited);

        // Display mastery from persisted mastery table; attempts remain as history for the explainer.
  const masteryRowsForDecks = masteryRowsLocal as MasteryRow[];
        Object.values(byDeck).forEach((deck) => {
          const stored = masteryRowsForDecks.filter((row) => String(row.deck_id) === deck.deckId);
          const m: NonNullable<DeckProgress["bloomMastery"]> = {};
          for (const row of stored) {
            const lvl = String(row.bloom_level) as BloomLevel;
            const pct = Number(row.mastery_pct ?? 0);
            m[lvl] = { correct: Math.max(0, Math.min(100, pct)), total: 100 };
          }
          deck.bloomMastery = m;
        });

    // Fetch per-deck summary (reviewed cards + mastered flag) from server API for parity
        try {
          await Promise.all(Object.values(byDeck).map(async (deck) => {
            const res = await fetch(`/api/decks/${deck.deckId}/summary`, { cache: "no-store" });
            if (res.ok) {
              const j = await res.json();
              byDeck[deck.deckId]!.reviewedCount = Number(j.reviewedCards ?? 0);
      byDeck[deck.deckId]!.isMastered = Boolean(j.mastered ?? false);
            }
          }));
        } catch {
          // ignore
        }

        // If any deck didn't get a server summary (fallback), compute mastered from mastery rows excluding Create
        const bloomsToCheck = BLOOM_LEVELS.filter((b) => b !== "Create");
        Object.values(byDeck).forEach((deck) => {
          if (typeof deck.isMastered === 'boolean') return; // already set via API
          const stored = masteryRowsForDecks.filter((row) => String(row.deck_id) === deck.deckId);
          let allMastered = true;
          for (const b of bloomsToCheck) {
            const r = stored.find((s) => String(s.bloom_level) === String(b));
            const pct = Number(r?.mastery_pct ?? NaN);
            if (!Number.isFinite(pct) || pct < 80) { allMastered = false; break; }
          }
          deck.isMastered = allMastered;
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
    const p = XP_MODEL.progressFor(commanderXpTotal);
    const currentThreshold = XP_MODEL.xpThresholdForLevel(p.level);
    const nextThreshold = XP_MODEL.xpThresholdForLevel(p.nextLevel);
    return { level: p.level, xpIntoLevel: p.current, xpForLevel: Math.max(1, nextThreshold - currentThreshold), xpToNext: p.toNext };
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
  totalReviewed += Math.max(0, Number(deck.reviewedCount ?? 0));
    }
    return { reviewed: totalReviewed, masteredDecks };
  }, [progressToDisplay]);

  const [smaOpen, setSmaOpen] = useState(false);

  // Open accuracy modal for a given attempt
  const openAttemptAccuracy = async (deckId: number, attemptId: number, accPct: number) => {
    setSelectedAttempt({ deckId, attemptId });
    setAccuracyPct(accPct);
    // If we already have answers cached for this attempt, reuse them immediately and skip fetch
    const cached = attemptAnswersCache[deckId]?.[attemptId];
    if (cached) {
      setAccuracyAnswers(cached);
      setAccuracyLoading(false);
      setAccuracyOpen(true);
      // Ensure cards metadata still loads if absent (async & fire-and-forget)
      if (!cardsByDeck[deckId]) {
        (async () => {
          try {
            const cards = await cardsRepo.listByDeck(deckId);
            const map: Record<number, { id: number; [k: string]: unknown }> = {};
            for (const c of cards) map[c.id] = { ...c } as any;
            setCardsByDeck((prev) => ({ ...prev, [deckId]: map }));
          } catch {}
        })();
      }
      return;
    }
    setAccuracyAnswers(null);
    setAccuracyLoading(true);
    setAccuracyOpen(true);
    try {
      const res = await fetch(`/api/quest/${deckId}/attempts/last-answers?attemptId=${attemptId}`, { cache: 'no-store' });
      let answers: MissionAnswer[] = [];
      if (res.ok) {
        const data = await res.json();
        if (data?.found && Array.isArray(data.answers)) {
          answers = data.answers as MissionAnswer[];
        }
      }
      setAccuracyAnswers(answers);
      setAttemptAnswersCache(prev => ({
        ...prev,
        [deckId]: { ...(prev[deckId] || {}), [attemptId]: answers }
      }));
      if (!cardsByDeck[deckId]) {
        try {
          const cards = await cardsRepo.listByDeck(deckId);
          const map: Record<number, { id: number; [k: string]: unknown }> = {};
          for (const c of cards) map[c.id] = { ...c } as any;
          setCardsByDeck((prev) => ({ ...prev, [deckId]: map }));
        } catch {}
      }
    } catch {
      setAccuracyAnswers([]);
    } finally {
      setAccuracyLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-8 xl:px-12 py-8 max-w-[1600px]">
      <div className="max-w-6xl xl:max-w-[1400px] mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900">
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
            value={globalProgress.xpIntoLevel}
            maxValue={globalProgress.xpForLevel}
            className="text-blue-500"
          />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900">
            {globalProgress.xpIntoLevel}
                        </span>
                        <span className="text-sm text-gray-500">
            / {globalProgress.xpForLevel} XP
                        </span>
            <span className="mt-1 text-xs text-gray-400">Remaining: {globalProgress.xpToNext}</span>
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
          const { firstName: first, avatarUrl: avatar } = resolveUserDisplay(user);
                  return (
                    <AgentCard
                      displayName={first}
                      level={globalProgress.level}
                      tokens={userSettings.tokens}
            avatarUrl={avatar}
                      variant="dashboard"
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
          <div className="space-y-6">
            {/* Display folders with their decks */}
            {folders.map((folder) => {
              const folderDecks = progressToDisplay.filter((deck) => {
                // Find the deck's folder_id from the original deck data
                const deckData = (decks ?? []).find((d) => String(d.id) === deck.deckId);
                return deckData && Number(deckData.folder_id) === folder.id;
              });

              if (folderDecks.length === 0) return null;

              return (
                <Collapsible key={folder.id} className="group">
                  {/* Folder header - now the trigger */}
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between space-x-3 bg-gray-50 p-4 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg ${folder.iconBgClass} flex items-center justify-center`}>
                          <BookOpen className={`w-4 h-4 ${folder.colorClass}`} />
                        </div>
                        <h3 className={`text-lg font-semibold ${folder.colorClass}`}>
                          {folder.name}
                        </h3>
                        <span className="text-sm text-gray-500">
                          ({folderDecks.length} deck{folderDecks.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <ChevronDown className="text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>

                  {/* Decks in this folder */}
                  <CollapsibleContent>
                    <div className="space-y-4 mt-4 ml-11">
                      {folderDecks.map((deck) => (
                        <Collapsible
                          key={deck.deckId}
                          className="group bg-white p-6 rounded-2xl shadow-sm"
                        >
                          <CollapsibleTrigger className="w-full">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 text-left">
                                {deck.deckName}
                              </h4>
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
                          <div className="mt-4 flex flex-col md:flex-row gap-6">
                            <div className="flex-1 md:w-1/2 space-y-3">
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

                                  <div
                                    className="relative w-full bloom-prestige-wrapper"
                                    data-bloom-level={level}
                                    style={{
                                      // prestige fill: clamp to [80%, percentage + 3%] for soft edge
                                      ['--prestige-fill' as any]: `${Math.min(100, Math.max(80, percentage + 3))}%`,
                                      // control dot spacing slightly by level difficulty (harder = denser -> smaller gap)
                                      ['--gap-x' as any]: level === 'Remember' ? '40px' : level === 'Understand' ? '36px' : level === 'Apply' ? '32px' : level === 'Analyze' ? '28px' : level === 'Evaluate' ? '24px' : '20px',
                                      ['--gap-y' as any]: '18px',
                                    }}
                                  >
                                    {/* progress bar background */}
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden relative">
                                      {/* Base segment up to 80% (flat, solid) */}
                                      <div
                                        className="h-2.5 rounded-full transition-all duration-700 ease-out"
                                        style={{ width: `${Math.min(percentage, 80)}%`, background: grad }}
                                      />
                                      {/* Shimmering segment beyond 80% */}
                                      {percentage > 80 && (
                                                                              <div
                                                                                className={`h-2.5 rounded-full absolute top-0 transition-all duration-700 ease-out prestige-segment prestige-${level.toLowerCase()}`}
                                                                                data-bloom-level={level}
                                                                                style={{
                                                                                  left: '80%',
                                                                                  width: `${Math.min(percentage - 80, 20)}%`,
                                                                                  background: grad,
                                                                                  position: 'absolute'
                                                                                }}
                                                                              >
                                                                                <div style={{position:'absolute',inset:0,background:grad}} aria-hidden />
                                                                              </div>
                                      )}
                                      {/* Fallback sparkle element (visible when browser lacks mask support) */}
                                      {percentage > 80 && (
                                        <div className="sparkle-fallback" aria-hidden>
                                          <div className="dots" />
                                        </div>
                                      )}
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

                                  <button
                                    type="button"
                                    className="text-sm font-medium text-blue-600 ml-3 hover:underline"
                                    title="How is this mastery calculated?"
                                    onClick={async () => {
                                      try {
                                        setExplainerOpen({ deckId: Number(deck.deckId), level });
                                        const sb = getSupabaseClient();
                                        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
                                        // Fetch attempts for this deck over 90 days (quest + non-quest), parse breakdown per bloom
                                        const { data: attempts } = await sb
                                          .from("user_deck_mission_attempts")
                                          .select("bloom_level, score_pct, cards_seen, cards_correct, ended_at, mode, breakdown")
                                          .eq("deck_id", Number(deck.deckId))
                                          .gte("ended_at", cutoff)
                                          .order("ended_at", { ascending: false })
                                          .limit(50);
                                        const rows: Array<{ at: string; mode?: string | null; acc: number; seen: number; correct: number }> = [];
                                        const lvl = level as string;
                                        for (const r of (attempts ?? []) as Array<{ bloom_level?: string | null; score_pct?: number | null; cards_seen?: number | null; cards_correct?: number | null; ended_at?: string | null; mode?: string | null; breakdown?: Record<string, { scorePct?: number; cardsSeen?: number; cardsCorrect?: number }> | null }>) {
                                          const ended = r.ended_at ?? new Date().toISOString();
                                          if (r.breakdown && typeof r.breakdown === 'object' && r.breakdown[lvl]) {
                                            const b = r.breakdown[lvl]!;
                                            rows.push({ at: ended, mode: r.mode ?? null, acc: Number(b.scorePct ?? 0), seen: Number(b.cardsSeen ?? 0), correct: Number(b.cardsCorrect ?? 0) });
                                          } else if ((r.bloom_level ?? '') === lvl) {
                                            const acc = Number(r.score_pct ?? 0);
                                            rows.push({ at: ended, mode: r.mode ?? null, acc, seen: Number(r.cards_seen ?? 0), correct: Number(r.cards_correct ?? 0) });
                                          }
                                        }
                                        // Pull current mastery factors for this deck/bloom from the cached mastery list
                                        const match = masteryRows.find((r) => String(r.deck_id) === deck.deckId && String(r.bloom_level) === level);
                                        const retentionPct = Math.round(Math.max(0, Math.min(1, Number(match?.retention_strength ?? 0))) * 1000) / 10;
                                        const masteryPct = Math.round(Math.max(0, Math.min(100, Number(match?.mastery_pct ?? 0))) * 10) / 10;
                                        // Fetch server-computed AWA for 1:1 parity
                                        let awaPct = 0;
                                        try {
                                          const res = await fetch(`/api/decks/${deck.deckId}/mastery-awa?level=${encodeURIComponent(level)}`);
                                          if (res.ok) {
                                            const j = await res.json();
                                            if (typeof j.awa === 'number') awaPct = Math.round(j.awa * 1000) / 10;
                                          }
                                        } catch {}
                                        // Compute coverage counts as Seen/Total via cards and user_deck_srs
                                        let coverageSeen: number | undefined;
                                        let coverageTotal: number | undefined;
                                        try {
                                          const cardsRes = await sb
                                            .from("cards")
                                            .select("id")
                                            .eq("deck_id", Number(deck.deckId))
                                            .eq("bloom_level", level);
                                          const cardIds = (cardsRes.data ?? []).map((c: any) => Number(c.id));
                                          coverageTotal = cardIds.length;
                                          if (user && cardIds.length > 0) {
                                            const srsRes = await sb
                                              .from("user_deck_srs")
                                              .select("card_id, attempts")
                                              .eq("user_id", user.id)
                                              .eq("deck_id", Number(deck.deckId))
                                              .in("card_id", cardIds);
                                            const rowsSrs = (srsRes.data ?? []) as Array<{ card_id: number; attempts: number }>;
                                            coverageSeen = rowsSrs.filter((r) => Number(r.attempts ?? 0) > 0).length;
                                          }
                                        } catch {}
                                        setExplainerData({ rows, factors: { retentionPct, awaPct, masteryPct, coverageSeen, coverageTotal } });
                                      } catch {
                                        setExplainerData({ rows: [], note: 'Could not load attempts. Ensure you are logged in and have recent activity.' });
                                      }
                                    }}
                                  >
                                    {formatPercent1(percentage)}
                                  </button>
                                </div>
                              );
                              })}
                            </div>
                            {/* Right column: chart + attempts */}
                            <div className="md:w-1/2 w-full relative">
                              <div className="absolute right-0 -top-8 md:top-0 md:-right-0 md:translate-y-[-110%]">
                                <button onClick={() => setSmaOpen(true)} className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 border border-gray-200 hover:bg-gray-200">What is SMA?</button>
                              </div>
                              <DeckProgressChart
                                deckId={Number(deck.deckId)}
                                height={180}
                                onPointClick={(attemptId, accPct) => openAttemptAccuracy(Number(deck.deckId), attemptId, accPct)}
                              />
                              {(() => {
                                const idNum = Number(deck.deckId);
                                const attempts = deckAttempts[idNum] || [];
                                if (attempts.length === 0) return null;
                                return (
                                  <div className="mt-4">
                                    <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Recent Attempts</div>
                                    <ul className="space-y-1">
                                      {attempts.map((a) => (
                                        <li key={a.id}>
                                          <button
                                            type="button"
                                            onClick={() => openAttemptAccuracy(idNum, a.id, a.acc)}
                                            className="w-full text-left px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm transition text-xs flex items-center justify-between"
                                            aria-label={`View attempt ${a.id} accuracy details`}
                                          >
                                            <span className="truncate">{new Date(a.ended_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {a.mode ?? 'quest'}</span>
                                            <span className="font-semibold text-blue-600">{formatPercent1(a.acc)}</span>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                );
                              })()}
                            </div>
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
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {/* Decks without folders */}
            {progressToDisplay.filter((deck) => {
              const deckData = (decks ?? []).find((d) => String(d.id) === deck.deckId);
              return !deckData || !deckData.folder_id;
            }).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-500">
                    Unorganized
                  </h3>
                </div>
                <div className="space-y-4 ml-11">
                  {progressToDisplay.filter((deck) => {
                    const deckData = (decks ?? []).find((d) => String(d.id) === deck.deckId);
                    return !deckData || !deckData.folder_id;
                  }).map((deck) => (
                    <Collapsible
                      key={deck.deckId}
                      className="group bg-white p-6 rounded-2xl shadow-sm"
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 text-left">
                              {deck.deckName}
                            </h4>
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
                        <div className="mt-4 flex flex-col md:flex-row gap-6">
                          <div className="flex-1 md:w-1/2 space-y-3">
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

                                <div className="relative w-full bloom-prestige-wrapper" data-bloom-level={level}>
                                  {/* progress bar background */}
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden relative">
                                    {/* Base segment up to 80% (flat, solid) */}
                                    <div
                                      className="h-2.5 rounded-full transition-all duration-700 ease-out"
                                      style={{ width: `${Math.min(percentage, 80)}%`, background: grad }}
                                    />
                                    {/* Shimmering segment beyond 80% */}
                                    {percentage > 80 && (
                                                                          <div
                                                                            className={`h-2.5 rounded-full absolute top-0 transition-all duration-700 ease-out prestige-segment prestige-${level.toLowerCase()}`}
                                                                            data-bloom-level={level}
                                                                            style={{
                                                                              left: '80%',
                                                                              width: `${Math.min(percentage - 80, 20)}%`,
                                                                              background: grad
                                                                            }}
                                                                          >
                                                                            <div style={{position:'absolute',inset:0,background:grad}} aria-hidden />
                                                                          </div>
                                    )}
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

                                <button
                                  type="button"
                                  className="text-sm font-medium text-blue-600 ml-3 hover:underline"
                                  title="How is this mastery calculated?"
                                  onClick={async () => {
                                    try {
                                      setExplainerOpen({ deckId: Number(deck.deckId), level });
                                      const sb = getSupabaseClient();
                                      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
                                      // Fetch attempts for this deck over 90 days (quest + non-quest), parse breakdown per bloom
                                      const { data: attempts } = await sb
                                        .from("user_deck_mission_attempts")
                                        .select("bloom_level, score_pct, cards_seen, cards_correct, ended_at, mode, breakdown")
                                        .eq("deck_id", Number(deck.deckId))
                                        .gte("ended_at", cutoff)
                                        .order("ended_at", { ascending: false })
                                        .limit(50);
                                      const rows: Array<{ at: string; mode?: string | null; acc: number; seen: number; correct: number }> = [];
                                      const lvl = level as string;
                                      for (const r of (attempts ?? []) as Array<{ bloom_level?: string | null; score_pct?: number | null; cards_seen?: number | null; cards_correct?: number | null; ended_at?: string | null; mode?: string | null; breakdown?: Record<string, { scorePct?: number; cardsSeen?: number; cardsCorrect?: number }> | null }>) {
                                        const ended = r.ended_at ?? new Date().toISOString();
                                        if (r.breakdown && typeof r.breakdown === 'object' && r.breakdown[lvl]) {
                                          const b = r.breakdown[lvl]!;
                                          rows.push({ at: ended, mode: r.mode ?? null, acc: Number(b.scorePct ?? 0), seen: Number(b.cardsSeen ?? 0), correct: Number(b.cardsCorrect ?? 0) });
                                        } else if ((r.bloom_level ?? '') === lvl) {
                                          const acc = Number(r.score_pct ?? 0);
                                          rows.push({ at: ended, mode: r.mode ?? null, acc, seen: Number(r.cards_seen ?? 0), correct: Number(r.cards_correct ?? 0) });
                                        }
                                      }
                                      // Pull current mastery factors for this deck/bloom from the cached mastery list
                                      const match = masteryRows.find((r) => String(r.deck_id) === deck.deckId && String(r.bloom_level) === level);
                                      const retentionPct = Math.round(Math.max(0, Math.min(1, Number(match?.retention_strength ?? 0))) * 1000) / 10;
                                      const masteryPct = Math.round(Math.max(0, Math.min(100, Number(match?.mastery_pct ?? 0))) * 10) / 10;
                                      // Fetch server-computed AWA for 1:1 parity
                                      let awaPct = 0;
                                      try {
                                        const res = await fetch(`/api/decks/${deck.deckId}/mastery-awa?level=${encodeURIComponent(level)}`);
                                        if (res.ok) {
                                          const j = await res.json();
                                          if (typeof j.awa === 'number') awaPct = Math.round(j.awa * 1000) / 10;
                                        }
                                      } catch {}
                                      // Compute coverage counts as Seen/Total via cards and user_deck_srs
                                      let coverageSeen: number | undefined;
                                      let coverageTotal: number | undefined;
                                      try {
                                        const cardsRes = await sb
                                          .from("cards")
                                          .select("id")
                                          .eq("deck_id", Number(deck.deckId))
                                          .eq("bloom_level", level);
                                        const cardIds = (cardsRes.data ?? []).map((c: any) => Number(c.id));
                                        coverageTotal = cardIds.length;
                                        if (user && cardIds.length > 0) {
                                          const srsRes = await sb
                                            .from("user_deck_srs")
                                            .select("card_id, attempts")
                                            .eq("user_id", user.id)
                                            .eq("deck_id", Number(deck.deckId))
                                            .in("card_id", cardIds);
                                          const rowsSrs = (srsRes.data ?? []) as Array<{ card_id: number; attempts: number }>;
                                          coverageSeen = rowsSrs.filter((r) => Number(r.attempts ?? 0) > 0).length;
                                        }
                                      } catch {}
                                      setExplainerData({ rows, factors: { retentionPct, awaPct, masteryPct, coverageSeen, coverageTotal } });
                                    } catch {
                                      setExplainerData({ rows: [], note: 'Could not load attempts. Ensure you are logged in and have recent activity.' });
                                    }
                                  }}
                                >
                                  {formatPercent1(percentage)}
                                </button>
                              </div>
                            );
                            })}
                          </div>
                          <div className="md:w-1/2 w-full relative">
                            <div className="absolute right-0 -top-8 md:top-0 md:translate-y-[-110%]">
                              <button onClick={() => setSmaOpen(true)} className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 border border-gray-200 hover:bg-gray-200">What is SMA?</button>
                            </div>
                            <DeckProgressChart
                              deckId={Number(deck.deckId)}
                              height={180}
                              onPointClick={(attemptId, accPct) => openAttemptAccuracy(Number(deck.deckId), attemptId, accPct)}
                            />
                            {(() => {
                              const idNum = Number(deck.deckId);
                              const attempts = deckAttempts[idNum] || [];
                              if (attempts.length === 0) return null;
                              return (
                                <div className="mt-4">
                                  <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Recent Attempts</div>
                                  <ul className="space-y-1">
                                    {attempts.map((a) => (
                                      <li key={a.id}>
                                        <button
                                          type="button"
                                          onClick={() => openAttemptAccuracy(idNum, a.id, a.acc)}
                                          className="w-full text-left px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm transition text-xs flex items-center justify-between"
                                          aria-label={`View attempt ${a.id} accuracy details`}
                                        >
                                          <span className="truncate">{new Date(a.ended_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {a.mode ?? 'quest'}</span>
                                          <span className="font-semibold text-blue-600">{formatPercent1(a.acc)}</span>
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })()}
                          </div>
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
                </div>
              </div>
            )}
          </div>
        </section>

  {/* Removed legacy aggregate "Progress Over Time" chart to reclaim vertical space */}
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
      {/* Mastery explainer dialog */}
      <Dialog open={!!explainerOpen} onOpenChange={(open) => { if (!open) { setExplainerOpen(null); setExplainerData(null); } }}>
      <DialogContent className="bg-white max-w-xl">
        <DialogHeader>
          <DialogTitle>How this mastery is computed</DialogTitle>
          <DialogDescription>
            Mastery = 0.6 × Retention + 0.4 × Attempt‑Weighted Accuracy (AWA)
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-gray-700 space-y-3">
          {explainerData?.factors ? (
            <div className="grid grid-cols-2 gap-2 p-2 rounded border border-gray-200 bg-gray-50">
              <div><span className="font-medium">Retention:</span> {explainerData.factors.retentionPct.toFixed(1)}%</div>
              <div><span className="font-medium">Attempt‑Weighted Accuracy:</span> {explainerData.factors.awaPct.toFixed(1)}%</div>
              {typeof explainerData.factors.coverageSeen === 'number' && typeof explainerData.factors.coverageTotal === 'number' ? (
                <div>
                  <span className="font-medium">Unique cards seen:</span> {explainerData.factors.coverageSeen} / {explainerData.factors.coverageTotal}
                </div>
              ) : null}
              <div><span className="font-medium">Current Mastery:</span> {explainerData.factors.masteryPct.toFixed(1)}%</div>
            </div>
          ) : null}
          <div>
            <div className="font-medium">Recent attempts for this Bloom</div>
            <div className="mt-1 rounded border border-gray-200 bg-gray-50 max-h-56 overflow-auto">
              {(explainerData?.rows ?? []).length === 0 ? (
                <div className="p-3 text-gray-500">No recent attempts found for this Bloom.</div>
              ) : (
                <ul className="divide-y divide-gray-200">
                    {(explainerData?.rows ?? []).map((r, i) => (
                    <li key={i} className="px-3 py-2 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-500">{new Date(r.at).toLocaleString()} · {r.mode ?? 'quest'}</div>
                        <div className="text-sm">Accuracy {r.acc.toFixed(1)}% · Correct {r.correct} / Seen {r.seen}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {explainerData?.note && <div className="text-xs text-red-600">{explainerData.note}</div>}
          <div className="text-xs text-gray-600">
            Notes:
            <ul className="list-disc list-inside space-y-1">
              <li>Retention comes from per‑card SRS accuracy for this deck/Bloom.</li>
              <li>AWA weights recent sessions more (7‑day half‑life), bundles attempts within 20 minutes, and scales by coverage.</li>
              <li>If you expect an attempt to appear but don’t see it, verify it in user_deck_mission_attempts.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
      </Dialog>
      <AccuracyDetailsModal
        open={accuracyOpen}
        onClose={() => { setAccuracyOpen(false); setSelectedAttempt(null); }}
        answers={accuracyAnswers}
        cardsById={selectedAttempt ? cardsByDeck[selectedAttempt.deckId] : undefined}
        accuracyPercent={typeof accuracyPct === 'number' ? accuracyPct : undefined}
        loading={accuracyLoading}
      />
      </div>
    </main>
  );
}
