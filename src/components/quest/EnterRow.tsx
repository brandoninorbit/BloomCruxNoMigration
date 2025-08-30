"use client";
import React from "react";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { BLOOM_COLOR_HEX } from "@/types/card-catalog";
import { ChevronDown, ChevronUp, Lock as LockIcon } from "lucide-react";

export type LevelInfoLite = {
  level: DeckBloomLevel;
  totalCards: number;
  missionsCompleted: number;
  totalMissions: number;
  mastered: boolean;
  unlocked: boolean;
};

export default function EnterRow({ deckId, li }: { deckId: number; li: LevelInfoLite }) {
  const [expanded, setExpanded] = React.useState(false);
  const color = BLOOM_COLOR_HEX[li.level] || "#e2e8f0";
  const isStarted = li.missionsCompleted > 0 && li.missionsCompleted < li.totalMissions;
  const isCompleted = li.missionsCompleted >= li.totalMissions && li.totalMissions > 0;
  const multi = li.totalMissions > 1;

  return (
    <div className="w-full">
      <div
        className="w-full flex items-center justify-between rounded-lg border p-4"
        style={{
          backgroundColor: li.unlocked ? "#fff" : "#f8fafc",
          borderColor: li.unlocked ? color : "#e2e8f0",
          opacity: li.unlocked ? 1 : 0.6,
        }}
        aria-disabled={!li.unlocked}
      >
        <div className="text-left">
          <div className="font-semibold" style={{ color }}>{li.level}</div>
          <div className="text-sm text-slate-600">
            {li.mastered ? "Mastered • Replay available" : `${Math.min(li.missionsCompleted, li.totalMissions)} / ${li.totalMissions} missions`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {li.unlocked ? (
            <>
              {li.mastered ? (
                <a
                  href={`/decks/${deckId}/quest?level=${encodeURIComponent(li.level)}&restart=1`}
                  className="text-sm font-medium px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800"
                >
                  Restart Mission
                </a>
              ) : isStarted ? (
                <>
                  <a
                    href={`/decks/${deckId}/quest?level=${encodeURIComponent(li.level)}`}
                    className="text-sm font-medium px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Resume {li.level}
                  </a>
                  <a
                    href={`/decks/${deckId}/quest?level=${encodeURIComponent(li.level)}&restart=1`}
                    className="text-sm font-medium px-3 py-1.5 rounded bg-slate-200 text-slate-700"
                  >
                    Restart
                  </a>
                </>
              ) : isCompleted ? (
                <a
                  href={`/decks/${deckId}/quest?level=${encodeURIComponent(li.level)}&restart=1`}
                  className="text-sm font-medium px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800"
                >
                  Restart Mission
                </a>
              ) : (
                <a
                  href={`/decks/${deckId}/quest?level=${encodeURIComponent(li.level)}`}
                  className="text-sm font-medium px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Start {li.level}
                </a>
              )}
              {multi && (
                <button
                  type="button"
                  className="ml-1 rounded p-1 text-slate-600 hover:bg-slate-100"
                  aria-expanded={expanded}
                  aria-label={expanded ? `Hide ${li.level} missions` : `Show ${li.level} missions`}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
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

      {expanded && multi && (
        <div className="mt-2 ml-3 border-l pl-4 space-y-2">
          {Array.from({ length: li.totalMissions }).map((_, idx) => {
            const ord = idx + 1;
            const isDone = ord <= li.missionsCompleted;
            const isNext = ord === li.missionsCompleted + 1;
            const actionable = isNext || isDone;
            return (
              <div key={ord} className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">Mission {ord}</span>
                  <span className="text-slate-500"> • {isDone ? "Completed" : isNext ? "Available" : "Locked"}</span>
                </div>
                <a
                  href={`/decks/${deckId}/quest?level=${encodeURIComponent(li.level)}`}
                  className={`text-sm font-medium px-3 py-1.5 rounded ${actionable ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-200 text-slate-600 cursor-not-allowed"}`}
                  aria-disabled={!actionable}
                  onClick={(e) => {
                    if (!actionable) e.preventDefault();
                  }}
                >
                  {isDone ? `Restart` : isNext ? `Start` : "Locked"}
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
