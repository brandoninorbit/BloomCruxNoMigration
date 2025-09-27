"use client";

import React, { useEffect, useMemo } from "react";
import type { DeckCard } from "@/types/deck-cards";

/**
 * AccuracyDetailsModal
 * Reusable modal showing per-card performance for the most recently completed mission.
 * Weak cards: any card answered incorrectly (correct === 0 or false)
 * Strong points: cards answered correctly (correct >= 0.65 fraction OR boolean true)
 * Cards can appear in neither group if partially correct but < 0.65 (future nuance) – currently treated as weak if < 0.65.
 */
export type MissionAnswer = { cardId: number; correct: boolean | number };

export interface AccuracyDetailsModalProps {
  open: boolean;
  onClose: () => void;
  answers: MissionAnswer[] | null | undefined;
  cardsById?: Record<number, DeckCard> | null;
  accuracyPercent?: number; // overall mission accuracy (0-100)
  loading?: boolean;
}

function classify(answers: MissionAnswer[] | null | undefined) {
  const weak: MissionAnswer[] = [];
  const strong: MissionAnswer[] = [];
  if (!answers || answers.length === 0) return { weak, strong };
  for (const a of answers) {
    const val = typeof a.correct === "number" ? a.correct : (a.correct ? 1 : 0);
    if (val >= 0.65) strong.push(a); else weak.push(a);
  }
  return { weak, strong };
}

export const AccuracyDetailsModal: React.FC<AccuracyDetailsModalProps> = (props: AccuracyDetailsModalProps) => {
  const { open, onClose, answers, cardsById, accuracyPercent, loading } = props;
  const { weak, strong } = useMemo(() => classify(answers), [answers]);
  // basic escape handling
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-200">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mission Accuracy Details{typeof accuracyPercent === "number" ? ` – ${Math.round(accuracyPercent * 10) / 10}%` : ""}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
            aria-label="Close accuracy details"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-8 text-sm">
          {loading && (
            <div className="text-slate-500">Loading answers…</div>
          )}
          {!loading && answers && answers.length === 0 && (
            <div className="text-slate-500">No answer data captured for this mission.</div>
          )}
          {!loading && answers && answers.length > 0 && (
            <>
              <section>
                <h3 className="font-semibold text-red-600 mb-2">Weak cards ({weak.length})</h3>
                {weak.length === 0 && <p className="text-slate-500">None. Great job!</p>}
                {weak.length > 0 && (
                  <ul className="space-y-1">
                    {weak.map((a: MissionAnswer) => {
                      const meta: Partial<Record<string, unknown>> | undefined = cardsById?.[a.cardId];
                      const suggested = meta && 'suggestedAnswer' in meta && typeof meta.suggestedAnswer === 'string' ? (meta.suggestedAnswer as string) : undefined;
                      const label = (meta && typeof meta.question === 'string' && meta.question)
                        || (meta && typeof meta.front === 'string' && meta.front)
                        || (meta && typeof meta.prompt === 'string' && meta.prompt)
                        || (meta && typeof meta.name === 'string' && meta.name)
                        || `Card #${a.cardId}`;
                      const back = (meta && typeof meta.explanation === 'string' && meta.explanation)
                        || (meta && typeof meta.back === 'string' && meta.back)
                        || (meta && typeof meta.answer === 'string' && meta.answer)
                        || suggested
                        || undefined;
                      return (
                        <li key={a.cardId} className="px-3 py-2 rounded-md bg-red-50 border border-red-100 flex items-start gap-2">
                          <span className="mt-0.5 inline-flex h-2 w-2 rounded-full bg-red-500" />
                          <div className="flex-1"><p className="text-red-700 font-medium">{label}</p>{back ? <p className="text-xs text-red-700/70 line-clamp-2">{back}</p> : null}</div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="font-semibold text-emerald-600 mb-2">Strong points ({strong.length})</h3>
                {strong.length === 0 && <p className="text-slate-500">No cards reached the strong threshold yet (≥65%).</p>}
                {strong.length > 0 && (
                  <ul className="space-y-1">
                    {strong.map((a: MissionAnswer) => {
                      const meta: Partial<Record<string, unknown>> | undefined = cardsById?.[a.cardId];
                      const suggested = meta && 'suggestedAnswer' in meta && typeof meta.suggestedAnswer === 'string' ? (meta.suggestedAnswer as string) : undefined;
                      const label = (meta && typeof meta.question === 'string' && meta.question)
                        || (meta && typeof meta.front === 'string' && meta.front)
                        || (meta && typeof meta.prompt === 'string' && meta.prompt)
                        || (meta && typeof meta.name === 'string' && meta.name)
                        || `Card #${a.cardId}`;
                      const back = (meta && typeof meta.explanation === 'string' && meta.explanation)
                        || (meta && typeof meta.back === 'string' && meta.back)
                        || (meta && typeof meta.answer === 'string' && meta.answer)
                        || suggested
                        || undefined;
                      return (
                        <li key={a.cardId} className="px-3 py-2 rounded-md bg-emerald-50 border border-emerald-100 flex items-start gap-2">
                          <span className="mt-0.5 inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          <div className="flex-1"><p className="text-emerald-700 font-medium">{label}</p>{back ? <p className="text-xs text-emerald-700/70 line-clamp-2">{back}</p> : null}</div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
        <footer className="px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-[var(--primary-color)] text-white text-sm font-medium hover:bg-[var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2"
          >Close</button>
        </footer>
      </div>
    </div>
  );
};

export default AccuracyDetailsModal;