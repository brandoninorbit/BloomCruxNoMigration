// Tailwind-only stat card for dashboard metrics
'use client';
function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="h-full p-4 text-center">
      <CardHeader className="flex-row items-center justify-center gap-2 p-2">
        {icon}
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <div className="relative">
        {/* Make entire card clickable without/anchor */}
        <Link href="/dashboard" aria-label="Go to dashboard" className="absolute inset-0 z-10 block" />
        <CardContent className="p-2">
          <div className="text-2xl font-bold">{value}</div>
        </CardContent>
      </div>
    </Card>
  );
}

import React, { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  BookOpen,
  Award,
  LineChart,
  ChevronDown,
  Zap,
  Vault,
  Rocket,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import AgentCard from './AgentCard';

/* ===========================
   Local types (no Studio/Firebase deps)
   =========================== */
type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

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

type DashboardSection = 'header' | 'devControls' | 'dossiers' | 'progressChart';
const initialSections: DashboardSection[] = ['header', 'devControls', 'dossiers', 'progressChart'];

/* ===========================
   Mock data (self‑contained)
   =========================== */
const MOCK_GLOBAL_PROGRESS: GlobalProgress = { level: 5, xp: 250, xpToNext: 1000 };

const MOCK_SETTINGS: UserSettings = { displayName: 'Mock User', tokens: 1250 };

const MOCK_DECK_PROGRESS: DeckProgress[] = [
  {
    deckId: 'mock1',
    deckName: 'Cellular Respiration',
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
    deckId: 'mock2',
    deckName: 'Photosynthesis',
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
  dailyXP: 850,
  bonusVault: 50,
  isXpBoosted: true,
};

/* ===========================
   Component
   =========================== */
export default function DashboardClient() {
  // Toggle mock data on/off
  const [showExample, setShowExample] = useState(true);

  // Optional dev controls (kept so the buttons are functional)
  const [devMode, setDevMode] = useState(false);
  const [showVault, setShowVault] = useState(false);

  // Select data to render (mock only in this self‑contained version)
  const progressToDisplay = useMemo<DeckProgress[]>(
    () => (showExample ? MOCK_DECK_PROGRESS : []),
    [showExample]
  );
  const globalProgressToDisplay = useMemo<GlobalProgress>(
    () => (showExample ? MOCK_GLOBAL_PROGRESS : { level: 1, xp: 0, xpToNext: 100 }),
    [showExample]
  );
  const settingsToDisplay = useMemo<UserSettings>(
    () => (showExample ? MOCK_SETTINGS : { displayName: 'Agent', tokens: 0 }),
    [showExample]
  );
  const xpStatsToDisplay = useMemo<UserXpStats>(
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

  const sectionsMap: Record<DashboardSection, React.ReactNode> = {
    header: (
      <Card>
        <CardHeader className="p-4">
          {/* New Link API: no */}
          <Link href="/dashboard" className="block focus:outline-none">
            <div className="group flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-lg px-2 py-1">
              <CardTitle className="group-hover:underline">Commander Overview</CardTitle>
            </div>
          </Link>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-6 md:col-span-2">
              {/* Inline global progress header */}
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">Commander Level</div>
                    <div className="text-sm text-muted-foreground">
                      {globalProgressToDisplay.xp} / {globalProgressToDisplay.xpToNext} XP
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    Session: {xpStatsToDisplay.sessionXP} • Daily: {xpStatsToDisplay.dailyXP}
                  </div>
                </div>
              </div>

              <div className="grid h-full grid-cols-1 gap-6 sm:grid-cols-2">
                <StatCard title="Total Cards Reviewed" value={overallStats.reviewed} icon={<BookOpen />} />
                <StatCard title="Decks Mastered" value={overallStats.masteredDecks} icon={<Award />} />
              </div>
            </div>

            <div className="h-full md:col-span-1">
              <AgentCard
                displayName={settingsToDisplay.displayName}
                level={globalProgressToDisplay.level}
                tokens={settingsToDisplay.tokens}
                avatarUrl={null}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    ),

    devControls: devMode ? (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Vault className="h-5 w-5 text-primary" />
            Developer Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={() => setShowVault((v) => !v)}>
            {showVault ? 'Hide' : 'Show'} Dev Vault
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              localStorage.removeItem('devMode');
              setDevMode(false);
              setShowVault(false);
            }}
          >
            Deactivate Dev Mode
          </Button>
        </CardContent>
      </Card>
    ) : null,

    dossiers: (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Deck Dossiers</CardTitle>
        </CardHeader>
        <CardDescription className="px-6 pb-4">
          Select a deck to continue your training.
        </CardDescription>
        <CardContent className="space-y-4">
          {progressToDisplay.length > 0 ? (
            progressToDisplay.map((progress) => (
              <Collapsible key={progress.deckId} className="rounded-lg border p-4" defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <div className="text-left">
                    <h4 className="font-semibold">{progress.deckName}</h4>
                    <p className="text-sm text-muted-foreground">
                      Level {progress.level} - {progress.xp}/{progress.xpToNext} XP
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {progress.isMastered && <Award className="h-5 w-5 text-yellow-500" />}
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-3 pt-4">
                  <div className="space-y-2">
                    {(Object.keys(progress.bloomMastery) as BloomLevel[]).map((level) => {
                      const bm = progress.bloomMastery as Partial<
                        Record<BloomLevel, { correct: number; total: number }>
                      >;
                      const levelData = bm[level];
                      if (!levelData || levelData.total === 0) return null;

                      const accuracy = Math.round((levelData.correct / levelData.total) * 100);
                      const isMastered = accuracy >= 80;

                      return (
                        <div key={level}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium">{level}</span>
                            <span
                              className={cn(
                                'font-semibold',
                                isMastered ? 'text-green-600' : 'text-amber-600'
                              )}
                            >
                              {accuracy}%
                            </span>
                          </div>
                          <Progress
                            value={accuracy}
                            className={isMastered ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/decks/${progress.deckId}/study/level-up`}>
                        <span className="inline-flex items-center gap-2">
                          <Rocket className="mr-2 h-4 w-4" />
                          Level Up
                        </span>
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href={`/decks/${progress.deckId}/study`}>
                        <span className="inline-flex items-center gap-2">Continue Study</span>
                      </Link>
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          ) : (
            <div className="col-span-full py-10 text-center">
              <p className="mb-4 text-muted-foreground">
                No decks found. Create a deck and start studying to see your progress!
              </p>
              <Button asChild className="mb-2">
                <Link href="/decks">
                  <span className="inline-flex items-center gap-2">Create a Deck</span>
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          {/* Use Button asChild instead of legacy Link wrapper */}
          <Button variant="link" className="text-xs text-muted-foreground hover:text-foreground" asChild>
            <Link href="/agent-classified">... Agent Classified</Link>
          </Button>
        </CardFooter>
      </Card>
    ),

    progressChart: (
      <Card className="mt-6 bg-muted/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <LineChart className="h-5 w-5" />
            Progress Over Time
          </CardTitle>
        </CardHeader>
        <CardDescription className="px-6 pb-4">
          This chart will show your review activity and mastery trends over the past month. Coming soon!
        </CardDescription>
        <CardContent className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Chart data will appear here.</p>
        </CardContent>
      </Card>
    ),
  };

  return (
    <div className="mx-auto px-6 py-12">
      {/* Light gray panel so the Agent card pops */}
      <div className="mx-auto max-w-5xl space-y-8 rounded-xl bg-slate-50 p-6 shadow-sm">
        {/* top header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-3xl font-headline text-foreground">Commander Debriefing</h1>
            <p className="font-body text-base text-muted-foreground">
              Review your overall performance and deck-specific mastery levels.
            </p>
          </div>

          <Button variant="link" onClick={() => setShowExample((v) => !v)}>
            {showExample ? 'Hide Example' : 'Show Example Data'}
          </Button>
        </div>

        {/* mock data banner */}
        {showExample && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <Info className="h-5 w-5 text-blue-700" />
            <div>
              <div className="font-semibold text-blue-800">Viewing Mock Data</div>
              <div className="text-sm text-blue-700">
                This is a preview of the dashboard. Click &quot;Hide Example&quot; to see your real progress.
              </div>
            </div>
          </div>
        )}

        {/* Bonus vault banner */}
        {xpStatsToDisplay.bonusVault > 0 && (
          <Card className="my-6 border-yellow-300 bg-yellow-50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-yellow-100 p-2">
                <Zap className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-bold text-yellow-800">Bonus Vault Ready!</p>
                <p className="text-sm text-yellow-700">
                  You have {xpStatsToDisplay.bonusVault} bonus XP waiting for tomorrow!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 2x booster banner */}
        {xpStatsToDisplay.isXpBoosted && (
          <Card className="my-6 border-blue-300 bg-blue-50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-blue-100 p-2">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-blue-800">2x XP Booster Active!</p>
                <p className="text-sm text-blue-700">All XP gains in your current session are doubled!</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* render sections */}
        <div className="space-y-8">
          {initialSections.map((sectionId) => {
            const card = sectionsMap[sectionId];
            if (!card) return null;
            return <div key={sectionId}>{card}</div>;
          })}
        </div>
      </div>
    </div>
  );
}
