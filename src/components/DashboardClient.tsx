/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/DashboardClient.tsx
"use client";
import React, { useMemo, useState } from "react";
import { useUser } from "@supabase/auth-helpers-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import AgentCard from "./AgentCard";

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
  bloomMastery: Partial<Record<BloomLevel, { correct: number; total: number }>>;
};

type GlobalProgress = { level: number; xp: number; xpToNext: number };
type UserXpStats = {
  sessionXP: number;
  dailyXP: number;
  bonusVault: number;
  isXpBoosted: boolean;
};
type UserSettings = { displayName: string; tokens: number };

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
  const user = useUser();
  // Default to real data for logged-in users, mock data if logged out
  const [showExample, setShowExample] = useState(!user);

  const progressToDisplay = useMemo<DeckProgress[]>(
    () => (showExample ? MOCK_DECK_PROGRESS : []),
    [showExample]
  );
  const globalProgress = useMemo<GlobalProgress>(
    () =>
      showExample ? MOCK_GLOBAL_PROGRESS : { level: 1, xp: 0, xpToNext: 100 },
    [showExample]
  );
    const userSettings = useMemo<UserSettings>(
    () => (showExample ? MOCK_SETTINGS : { displayName: 'Agent', tokens: 0 }),
    [showExample]
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
                 <AgentCard 
                    displayName={userSettings.displayName}
                    level={globalProgress.level}
                    tokens={userSettings.tokens}
                 />
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
                        Mastery:{" "}
                        {Math.round(
                          (Object.values(deck.bloomMastery).reduce(
                            (acc, curr) => acc + curr.correct,
                            0
                          ) /
                            Object.values(deck.bloomMastery).reduce(
                              (acc, curr) => acc + curr.total,
                              0
                            )) *
                            100
                        )}
                        % | {deck.xp}/{deck.xpToNext} XP
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
                    {(Object.keys(deck.bloomMastery) as BloomLevel[]).map(
                      (level) => {
                        const mastery = deck.bloomMastery[level];
                        if (!mastery) return null;
                        const percentage =
                          (mastery.correct / mastery.total) * 100;
                        return (
                          <div key={level} className="flex items-center">
                            <span className="text-sm font-medium text-gray-600 w-24">
                              {level}
                            </span>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className={cn(
                                  "h-2.5 rounded-full",
                                  percentage >= 80
                                    ? "bg-green-500"
                                    : "bg-orange-400"
                                )}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-600 ml-3">
                              {Math.round(percentage)}%
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Progress Over Time
          </h2>
          <p className="text-gray-600 mb-6">
            This chart will show your review activity and mastery trends over
            the past month. Coming soon!
          </p>
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center text-gray-500 h-48 flex items-center justify-center">
            Chart data will appear here.
          </div>
        </section>
      </div>
    </main>
  );
}
