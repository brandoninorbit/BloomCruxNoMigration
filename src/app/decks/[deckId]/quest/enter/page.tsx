"use client";
import { notFound, useParams } from "next/navigation";
import Image from "next/image";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { BLOOM_LEVELS, BLOOM_COLOR_HEX } from "@/types/card-catalog";
import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";
import { fetchProgress } from "@/lib/quest/repo";
import * as cardsRepo from "@/lib/cardsRepo";
import { Lock as LockIcon } from "lucide-react";
import { useState, useEffect } from "react";

export const dynamic = "force-dynamic";

// Client-side page that renders the mission selection UI with modal for locked quests.
export default function QuestEnterPage() {
  const route = useParams() as { deckId?: string } | null;
  const id = route?.deckId ? Number(route.deckId) : NaN;
  if (!Number.isFinite(id)) notFound();

  type BP = { totalCards?: number; missionsCompleted?: number; missionsPassed?: number; mastered?: boolean; accuracySum?: number; accuracyCount?: number; cleared?: boolean; weightedAvg?: number };
  type PerMap = Partial<Record<DeckBloomLevel, BP & { updatedSinceLastRun?: number }>>;
  const [levels, setLevels] = useState<Array<{
    level: DeckBloomLevel;
    totalCards: number;
    missionsCompleted: number;
    missionsPassed: number;
    totalMissions: number;
    mastered: boolean;
    unlocked: boolean;
    updatedSinceLastRun: number;
  }>>([]);
  const [unlockWhy, setUnlockWhy] = useState<Array<{ level: DeckBloomLevel; prevMastered: boolean; prevCleared: boolean; prevAvg: number; prevHasMission: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [modalLevel, setModalLevel] = useState<DeckBloomLevel | null>(null);
  const [recentAttempt, setRecentAttempt] = useState<{ accuracy: number; date: string } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch progress
  const { progress } = await fetchProgress(id);
  const fetchedPer = (progress ?? {}) as PerMap;

        // Fetch card totals
        const all = await cardsRepo.listByDeck(id);
        const map: Partial<Record<DeckBloomLevel, number>> = {};
        all.forEach((c) => {
          const lvl = (c.bloomLevel ?? "Remember") as DeckBloomLevel;
          map[lvl] = (map[lvl] ?? 0) + 1;
        });

        // Build levels
        const cap = DEFAULT_QUEST_SETTINGS.missionCap;
        const builtLevels = (BLOOM_LEVELS as DeckBloomLevel[]).map((lvl) => {
          const p: BP = (fetchedPer && fetchedPer[lvl]) || {};
          const totalCards = Number(p.totalCards ?? 0) || Number(map[lvl] ?? 0);
          const missionsCompleted = Number(p.missionsCompleted ?? 0);
          const missionsPassed = Number(p.missionsPassed ?? 0);
          const totalMissions = Math.ceil(totalCards / cap) || 0;
          const mastered = !!p.mastered;
          const updatedSinceLastRun = Number((fetchedPer?.[lvl] as (BP & { updatedSinceLastRun?: number }) | undefined)?.updatedSinceLastRun ?? 0);
          return { level: lvl, totalCards, missionsCompleted, missionsPassed, totalMissions, mastered, unlocked: false, updatedSinceLastRun };
        });

        // Compute unlocking
        const passThreshold = DEFAULT_QUEST_SETTINGS.passThreshold;
        const why: Array<{ level: DeckBloomLevel; prevMastered: boolean; prevCleared: boolean; prevAvg: number; prevHasMission: boolean }> = [];
        for (let i = 0; i < builtLevels.length; i++) {
          if (i === 0) {
            builtLevels[i]!.unlocked = true;
            why.push({ level: builtLevels[i]!.level, prevMastered: false, prevCleared: true, prevAvg: 100, prevHasMission: true });
            continue;
          }
          const prevLvl = builtLevels[i - 1]!.level;
          const prev = fetchedPer?.[prevLvl] as (BP & { missionUnlocked?: boolean }) | undefined;
          const prevMastered = !!prev?.mastered;
          // Treat a passed mission (missionsPassed > 0) as cleared if cleared flag hasn't been persisted yet.
          const inferredCleared = Number(prev?.missionsPassed ?? 0) > 0;
          const prevCleared = !!prev?.cleared || inferredCleared || !!prev?.missionUnlocked;
          // Consider a mission "attempted" if either missionsCompleted or missionsPassed incremented
          const prevHasMission = (prev?.missionsCompleted ?? prev?.missionsPassed ?? 0) > 0;
          const prevAvg = prev && (prev.accuracyCount ?? 0) > 0
            ? Math.round(((prev.accuracySum ?? 0) / Math.max(1, prev.accuracyCount ?? 0)) * 100)
            : 0;
          // Fallback unlock via accuracy average even if cleared bit missing
          const fallbackUnlock = !prevCleared && prevHasMission && prevAvg >= passThreshold;
          why.push({ level: builtLevels[i]!.level, prevMastered, prevCleared, prevAvg, prevHasMission });
          builtLevels[i]!.unlocked = prevMastered || prevCleared || fallbackUnlock;
        }

        setLevels(builtLevels);
        setUnlockWhy(why);
      } catch (error) {
        console.error("Error loading quest enter data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Quest Missions</h1>
          <a href={`/decks/${id}/study`} className="text-sm text-blue-700 hover:underline">Back to Study</a>
        </div>
        <div className="text-center py-8">Loading...</div>
      </main>
    );
  }

  // Icon mapping for each Bloom level
  const ICONS: Record<DeckBloomLevel, string> = {
    Remember: "/icons/PhotoIcon_Remember.svg",
    Understand: "/icons/LightBulbIcon_Understand.svg",
    Apply: "/icons/BuildIcon_Apply.svg",
    Analyze: "/icons/ChartIcon_Analyze.svg",
    Evaluate: "/icons/GaveIcon_Evaluate.svg",
    Create: "/icons/PalleteIcon_Create.svg",
  } as const;

  const handleLockedClick = async (level: DeckBloomLevel) => {
    setModalLevel(level);
    
    // Fetch the most recent attempt for the previous level
    const prevLevelIndex = BLOOM_LEVELS.indexOf(level) - 1;
    if (prevLevelIndex >= 0) {
      const prevLevel = BLOOM_LEVELS[prevLevelIndex] as DeckBloomLevel;
      try {
        const response = await fetch(`/api/quest/${id}/attempts`);
        if (response.ok) {
          const data = await response.json();
          
          // Check if the response contains an error or is invalid
          if (data && typeof data === 'object' && 'error' in data) {
            console.error('API error:', data.error);
            setRecentAttempt(null);
            return;
          }
          
          // Extract attempts array and total cards from response
          const attempts = data?.attempts;
          const totalCards = data?.totalCards || 0;
          
          // Ensure attempts is an array before filtering
          if (!Array.isArray(attempts)) {
            console.error('API response attempts is not a valid array:', attempts);
            setRecentAttempt(null);
            return;
          }
          
          const typedData: Array<{
            id: number;
            bloom_level: string;
            score_pct: number;
            ended_at: string;
            mode: string;
            stored?: { seen: number; correct: number };
            recomputed?: { seen: number; correct: number } | null;
          }> = attempts;
          
          const prevLevelAttempts = typedData.filter((attempt) => attempt.bloom_level === prevLevel);
          if (prevLevelAttempts.length > 0) {
            // Find the most recent quest attempt
            const questAttempts = prevLevelAttempts.filter(attempt => attempt.mode === 'quest');
            const mostRecentQuest = questAttempts.length > 0 ? questAttempts[0] : null;
            
            // Look for attempts with 100% coverage and 65%+ accuracy that might indicate mastery
            const masteryAttempts = prevLevelAttempts.filter(attempt => {
              const accuracy = attempt.score_pct; // score_pct is already a percentage
              const cardsSeen = attempt.recomputed?.seen || attempt.stored?.seen || 0;
              const coverage = totalCards > 0 ? (cardsSeen / totalCards) * 100 : 0;
              
              // Consider it a mastery attempt if coverage is 100% AND accuracy > 65%
              return coverage >= 100 && accuracy > 65;
            });
            
            let bestAttempt = mostRecentQuest;
            
            // If there's a 100% coverage attempt with better score than the most recent quest,
            // use that instead (this allows unlocking based on complete coverage mastery)
            if (masteryAttempts.length > 0 && mostRecentQuest) {
              const bestMastery = masteryAttempts.reduce((best: typeof masteryAttempts[0], current: typeof masteryAttempts[0]) => 
                current.score_pct > best.score_pct ? current : best
              );
              
              if (bestMastery.score_pct > mostRecentQuest.score_pct) {
                bestAttempt = bestMastery;
              }
            } else if (masteryAttempts.length > 0 && !mostRecentQuest) {
              // If no quest attempts but there are 100% coverage mastery attempts, use the best one
              bestAttempt = masteryAttempts.reduce((best: typeof masteryAttempts[0], current: typeof masteryAttempts[0]) => 
                current.score_pct > best.score_pct ? current : best
              );
            }
            
            if (bestAttempt) {
              setRecentAttempt({
                accuracy: bestAttempt.score_pct, // score_pct is already a percentage
                date: new Date(bestAttempt.ended_at).toLocaleDateString()
              });
            } else {
              setRecentAttempt(null);
            }
          } else {
            setRecentAttempt(null);
          }
        } else {
          console.error('Failed to fetch attempts, status:', response.status);
          setRecentAttempt(null);
        }
      } catch (error) {
        console.error('Failed to fetch recent attempt:', error);
        setRecentAttempt(null);
      }
    }
  };

  const closeModal = () => {
    setModalLevel(null);
    setRecentAttempt(null);
  };

  const getUnlockDetails = (level: DeckBloomLevel) => {
    const why = unlockWhy.find(w => w.level === level);
    if (!why) return null;
    return {
      prevLevel: BLOOM_LEVELS[BLOOM_LEVELS.indexOf(level) - 1] as DeckBloomLevel,
      prevMastered: why.prevMastered,
      prevCleared: why.prevCleared,
      prevAvg: why.prevAvg,
      prevHasMission: why.prevHasMission,
    };
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quest Missions</h1>
        <a href={`/decks/${id}/study`} className="text-sm text-blue-700 hover:underline">Back to Study</a>
      </div>

      <div className="space-y-3">
        {levels.map((li, idx) => {
          const color = BLOOM_COLOR_HEX[li.level] || "#e2e8f0";
          const isStarted = li.missionsCompleted > 0 && li.missionsCompleted < li.totalMissions;
          const isCompleted = li.totalMissions > 0 && li.missionsPassed >= li.totalMissions;
          const multi = li.totalMissions > 1;
          const nextUnlocked = levels[idx + 1]?.unlocked ?? false;
          const hasMissions = li.totalMissions > 0;
          const comingSoon = li.level === ("Create" as DeckBloomLevel);
          const shouldNudge = li.unlocked && !nextUnlocked && li.missionsCompleted > 0 && !li.mastered;
          return (
            <div key={li.level}>
              <div
                className={`w-full flex items-center justify-between rounded-[28px] shadow-lg p-4 ${!li.unlocked ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                style={{
                  backgroundColor: li.unlocked ? `${color}1A` : "#f8fafc",
                  opacity: li.unlocked ? 1 : 0.9,
                }}
                aria-disabled={!li.unlocked}
                onClick={!li.unlocked ? () => handleLockedClick(li.level) : undefined}
              >
                <div className="flex items-center gap-3">
                  <Image src={ICONS[li.level]} alt={`${li.level} icon`} width={28} height={28} className="h-7 w-7" />
                  <div className="text-left">
                    <div className="font-extrabold" style={{ color }}>{li.level}</div>
                    <div className="text-sm text-slate-600">
                      {comingSoon
                        ? "Coming soon"
                        : li.totalMissions === 0
                        ? `0 missions`
                        : isCompleted || li.mastered
                          ? `Completed • ${li.totalMissions} missions`
                          : isStarted
                            ? `${Math.min(li.missionsCompleted, li.totalMissions)} / ${li.totalMissions} completed`
                            : `${li.totalMissions} missions`}
                      {li.updatedSinceLastRun > 0 && (
                        <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs" style={{ background: "#f1f5f9", color: "#0f172a" }}>
                          Updated: +{li.updatedSinceLastRun} new
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {li.unlocked ? (
                    <>
                      {comingSoon ? (
                        <span className="text-sm font-medium px-3 py-1.5 rounded-[20px] bg-slate-200 text-slate-600 cursor-not-allowed" aria-disabled>Coming Soon</span>
                      ) : !hasMissions ? (
                        <span className="text-sm font-medium px-3 py-1.5 rounded-[20px] bg-slate-200 text-slate-600 cursor-not-allowed" aria-disabled>Start</span>
                      ) : isCompleted || li.mastered ? (
                        <a
                          href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}&restart=1`}
                          className="text-sm font-medium px-3 py-1.5 rounded-[20px] bg-slate-200 text-slate-700"
                        >
                          {shouldNudge ? "Try again to increase accuracy" : "Restart"}
                        </a>
                      ) : isStarted ? (
                        <>
                          <a
                            href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}`}
                            className="text-sm font-medium px-3 py-1.5 rounded-[20px] bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Resume
                          </a>
                          <a
                            href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}&restart=1`}
                            className="text-sm font-medium px-3 py-1.5 rounded-[20px] bg-slate-200 text-slate-700"
                          >
                            Restart
                          </a>
                        </>
                      ) : (
                        <a
                          href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}`}
                          className="text-sm font-medium px-3 py-1.5 rounded-[20px] bg-blue-600 text-white hover:bg-blue-700"
                        >
                          {shouldNudge ? "Try again to increase accuracy" : `Start ${li.level}`}
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600" aria-label="Locked">
                      <LockIcon className="text-amber-500" size={18} />
                      <span className="text-sm font-medium">Locked</span>
                    </div>
                  )}
                </div>
              </div>

              {multi && (
                <details className="mt-2 ml-3 border-l pl-4">
                  <summary className="cursor-pointer list-none text-sm text-slate-600 hover:text-slate-800 select-none">
                    Show missions
                  </summary>
                  <div className="mt-2 space-y-2">
                    {Array.from({ length: li.totalMissions }).map((_, idx) => {
                      const ord = idx + 1;
                      const isDone = ord <= li.missionsPassed;
                      const isNext = ord === li.missionsPassed + 1;
                      const actionable = li.unlocked && (isNext || isDone) && hasMissions && !comingSoon;
                      return (
                        <div key={ord} className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium">Mission {ord}</span>
                            <span className="text-slate-500"> • {isDone ? "Completed" : isNext ? "Available" : "Locked"}</span>
                          </div>
                          <a
                            href={`/decks/${id}/quest?level=${encodeURIComponent(li.level)}`}
                            className={`text-sm font-medium px-3 py-1.5 rounded-[20px] ${actionable ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-200 text-slate-600 cursor-not-allowed"}`}
                            aria-disabled={!actionable}
                            onClick={(e) => { if (!actionable) e.preventDefault(); }}
                          >
                            {isDone ? `Restart` : isNext ? `Start` : "Locked"}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal for locked quest details */}
      {modalLevel && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Why is {modalLevel} locked?</h2>
            {(() => {
              const details = getUnlockDetails(modalLevel);
              if (!details) return <p>Unable to determine unlock criteria.</p>;
              return (
                <div className="space-y-3">
                  <p>To unlock <strong>{modalLevel}</strong>, you need to complete the previous level: <strong>{details.prevLevel}</strong>.</p>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="font-medium mb-2">Current status of {details.prevLevel}:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {details.prevMastered && <li>✅ Mastered</li>}
                      {details.prevCleared && <li>✅ Is cleared (65% or higher required)</li>}
                      {!details.prevMastered && !details.prevCleared && (
                        <>
                          <li>❌ Not mastered</li>
                          <li>❌ Not cleared</li>
                          {details.prevHasMission ? (
                            <li>Last attempt accuracy: {details.prevAvg}% (need ≥65% to unlock)</li>
                          ) : (
                            <li>No missions completed yet</li>
                          )}
                        </>
                      )}
                    </ul>
                  </div>

                  {recentAttempt && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="font-medium mb-2">Most Recent Attempt:</p>
                      <div className="text-sm space-y-1">
                        <p><strong>Accuracy:</strong> {recentAttempt.accuracy.toFixed(2)}%</p>
                        <p><strong>Date:</strong> {recentAttempt.date}</p>
                      </div>
                    </div>
                  )}

                  {!details.prevMastered && !details.prevCleared && details.prevHasMission && details.prevAvg < 65 && (
                    <p className="text-sm text-gray-600 mt-4">
                      Try the {details.prevLevel} missions again to improve your accuracy and unlock {modalLevel}.
                    </p>
                  )}
                </div>
              );
            })()}
            <button
              onClick={closeModal}
              className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
