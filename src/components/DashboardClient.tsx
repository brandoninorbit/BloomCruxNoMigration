'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Award, BookOpen, ChevronDown, LineChart, Zap, Rocket } from 'lucide-react';
import AgentCard from '@/components/AgentCard';

/** tiny UI primitives (Tailwind only) */
function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(' ');
}
function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('rounded-2xl border bg-white shadow-sm', props.className)} />;
}
function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('p-4', props.className)} />;
}
function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...props} className={cn('text-lg font-semibold', props.className)} />;
}
function CardDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn('text-sm text-muted-foreground', props.className)} />;
}
function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('p-4 pt-0', props.className)} />;
}
function CardFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('p-4 pt-0', props.className)} />;
}
function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-white transition hover:opacity-90',
        props.className
      )}
    />
  );
}
function ButtonOutline(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-sm font-medium transition hover:bg-muted/40',
        props.className
      )}
    />
  );
}

/** Linear progress bar */
function ProgressBar({ value, barClass = 'bg-blue-500' }: { value: number; barClass?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200/70">
      <div className={cn('h-full rounded-full', barClass)} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Radial progress ring showing XP % toward next level */
function RadialProgress({
  value, // 0..1
  size = 64,
  strokeWidth = 10,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value || 0));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * clamped;
  const offset = c - dash;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#bfdbfe" strokeWidth={strokeWidth} fill="white" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#3b82f6"
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/** types + mock data (no studio deps) */
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
type UserXpStats = { sessionXP: number; dailyXP: number; bonusVault: number; isXpBoosted: boolean };
type UserSettingsLite = { displayName: string; tokens: number };

const bloomOrder: BloomLevel[] = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

const MOCK_GLOBAL: GlobalProgress = { level: 5, xp: 250, xpToNext: 1000 };
const MOCK_SETTINGS: UserSettingsLite = { displayName: 'Mock User', tokens: 1250 };
const MOCK_DECKS: DeckProgress[] = [
  {
    deckId: 'mock1',
    deckName: 'Cellular Respiration',
    totalCards: 25,
    lastStudied: new Date(),
    isMastered: false,
    level: 3,
    xp: 40,
    xpToNext: 150,
    bloomMastery: { Remember: { correct: 8, total: 10 }, Understand: { correct: 5, total: 7 } },
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
    bloomMastery: { Remember: { correct: 10, total: 10 }, Understand: { correct: 9, total: 10 }, Apply: { correct: 8, total: 10 } },
  },
];
const MOCK_XP: UserXpStats = { sessionXP: 120, dailyXP: 850, bonusVault: 50, isXpBoosted: true };

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="h-full p-4 text-center">
      <CardHeader className="flex-row items-center justify-center gap-2 p-2">
        {icon}
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function DashboardClient() {
  /** Show/hide ONLY the mock numbers. When hidden, level must be 1 and banners disappear. */
  const [showExample, setShowExample] = useState(true);

  // When mock is hidden, set level=1 and zero XP so the ring + counts reset properly.
  const decks = showExample ? MOCK_DECKS : [];
  const global: GlobalProgress = showExample
    ? MOCK_GLOBAL
    : { level: 1, xp: 0, xpToNext: 1000 };
  const settings: UserSettingsLite = showExample
    ? MOCK_SETTINGS
    : { displayName: 'Mock User', tokens: 0 };
  const xp: UserXpStats = showExample
    ? MOCK_XP
    : { sessionXP: 0, dailyXP: 0, bonusVault: 0, isXpBoosted: false };

  const overall = useMemo(() => {
    let reviewed = 0;
    let mastered = 0;
    decks.forEach((d) => {
      if (d.isMastered) mastered++;
      Object.values(d.bloomMastery).forEach((lvl) => {
        if (lvl) reviewed += lvl.total;
      });
    });
    return { reviewed, mastered };
  }, [decks]);

  const levelPct = Math.max(0, Math.min(1, global.xpToNext ? global.xp / global.xpToNext : 0));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-3xl font-headline text-foreground">Commander Debriefing</h1>
            <p className="font-body text-base text-muted-foreground">
              Review your overall performance and deck-specific mastery levels.
            </p>
          </div>
          <button
            className="text-primary underline-offset-4 hover:underline"
            onClick={() => setShowExample((v) => !v)}
          >
            {showExample ? 'Hide Example' : 'Show Example Data'}
          </button>
        </div>

        {/* Banners — only render when SHOWING example data AND the condition is true.
            When hidden, they are removed completely so the layout shifts up. */}
        {showExample && xp.bonusVault > 0 && (
          <Card className="my-6 border-yellow-300 bg-yellow-50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-yellow-100 p-2">
                <Zap className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-bold text-yellow-800">Bonus Vault Ready!</p>
                <p className="text-sm text-yellow-700">
                  You have {xp.bonusVault} bonus XP waiting for tomorrow!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {showExample && xp.isXpBoosted && (
          <Card className="my-6 border-blue-300 bg-blue-50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-blue-100 p-2">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-blue-800">2x XP Booster Active!</p>
                <p className="text-sm text-blue-700">
                  All XP gains in your current session are doubled!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview row */}
        <Card>
          <CardHeader className="flex-row items-center justify-between p-4">
            <CardTitle>Commander Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid items-stretch gap-6 lg:grid-cols-3">
              {/* Left: commander + stats */}
              <div className="flex flex-col gap-6 lg:col-span-2">
                {/* Commander Level (ring + bars + counts) */}
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-4 lg:gap-6">
                    {/* Radial ring with level in center */}
                    <div className="relative grid place-items-center">
                      <RadialProgress value={levelPct} size={64} strokeWidth={10} />
                      <div className="pointer-events-none absolute inset-0 grid place-items-center text-blue-600">
                        <span className="text-xl font-bold">{global.level}</span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-lg font-semibold">Commander Level</div>
                      <div className="mb-2 text-sm text-muted-foreground">
                        {global.xp} / {global.xpToNext} XP
                      </div>

                      {/* Session XP (blue) */}
                      <div className="mb-2">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Session XP</span>
                          <span className="font-medium">{xp.sessionXP} / 150</span>
                        </div>
                        <ProgressBar value={(xp.sessionXP / 150) * 100} barClass="bg-blue-500" />
                      </div>

                      {/* Daily XP (green) */}
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Daily XP</span>
                          <span className="font-medium">{xp.dailyXP} / 1000</span>
                        </div>
                        <ProgressBar value={(xp.dailyXP / 1000) * 100} barClass="bg-green-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Small stat cards (baseline aligns with AgentCard) */}
                <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-2">
                  <StatCard title="Total Cards Reviewed" value={overall.reviewed} icon={<BookOpen />} />
                  <StatCard title="Decks Mastered" value={overall.mastered} icon={<Award />} />
                </div>
              </div>

              {/* Right: Agent card (always rendered; narrow) */}
              <div className="lg:col-span-1">
                <AgentCard
                  displayName={settings.displayName}
                  level={global.level}
                  tokens={settings.tokens}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deck Dossiers */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Deck Dossiers</CardTitle>
          </CardHeader>
          <CardDescription className="px-6 pb-4">Select a deck to continue your training.</CardDescription>
          <CardContent className="space-y-4">
            {decks.length > 0 ? (
              decks.map((progress) => (
                <details key={progress.deckId} className="rounded-lg border p-4" open>
                  <summary className="flex w-full cursor-pointer list-none items-center justify-between">
                    <div className="text-left">
                      <h4 className="font-semibold">{progress.deckName}</h4>
                      <p className="text-sm text-muted-foreground">
                        Level {progress.level} - {progress.xp}/{progress.xpToNext} XP
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {progress.isMastered && <Award className="h-5 w-5 text-yellow-500" />}
                      <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                    </div>
                  </summary>

                  <div className="space-y-3 pt-4">
                    <div className="space-y-2">
                      {bloomOrder.map((lvl) => {
                        const data = progress.bloomMastery[lvl];
                        if (!data || data.total === 0) return null;
                        const acc = Math.round((data.correct / data.total) * 100);
                        const mastered = acc >= 80;
                        return (
                          <div key={lvl}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="font-medium">{lvl}</span>
                              <span className={cn('font-semibold', mastered ? 'text-green-600' : 'text-amber-600')}>
                                {acc}%
                              </span>
                            </div>
                            <ProgressBar value={acc} barClass={mastered ? 'bg-green-500' : 'bg-amber-500'} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Link href={`/decks/${progress.deckId}/study/level-up`} className="contents">
                        <ButtonOutline>
                          <Rocket className="mr-2 h-4 w-4" />
                          Level Up
                        </ButtonOutline>
                      </Link>
                      <Link href={`/decks/${progress.deckId}/study`} className="contents">
                        <Button>Continue Study</Button>
                      </Link>
                    </div>
                  </div>
                </details>
              ))
            ) : (
              <div className="py-10 text-center">
                <p className="mb-4 text-muted-foreground">
                  No decks found. Create a deck and start studying to see your progress!
                </p>
                <Link href="/decks" className="contents">
                  <Button className="mb-2">Create a Deck</Button>
                </Link>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-center">
            <Link href="/agent-classified" className="contents">
              <button className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                🔒 Agent Classified
              </button>
            </Link>
          </CardFooter>
        </Card>

        {/* Placeholder chart */}
        <Card className="mt-6 bg-neutral-100">
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
      </div>
    </div>
  );
}
