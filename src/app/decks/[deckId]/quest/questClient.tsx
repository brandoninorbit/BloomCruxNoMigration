"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckBloomLevel, DeckCard, DeckStandardMCQ, DeckFillMeta, DeckFillMetaV2, DeckFillMetaV3 } from "@/types/deck-cards";
import { BLOOM_LEVELS, BLOOM_COLOR_HEX } from "@/types/card-catalog";
import { startMission, resumeMission, recordAnswer, computePass, initUserBloomProgress, composeMission, initXpLedger } from "@/lib/quest/engine";
import type { MissionState, SRSPerformance, UserBloomProgress, MissionComposition } from "@/lib/quest/types";
import AgentCard from "@/components/AgentCard";
import { QuestProgress } from "@/components/QuestProgress";
import MCQStudy from "@/components/cards/MCQStudy";
import FillBlankStudy from "@/components/cards/FillBlankStudy";
import { fetchProgress, saveProgressRepo, fetchMission, upsertMission, fetchSrs, upsertSrs, logXpEvent } from "@/lib/quest/repo";

export default function QuestClient({ deckId }: { deckId: number }) {
  const router = useRouter();
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [progress, setProgress] = useState<UserBloomProgress | null>(null);
  const [mission, setMission] = useState<MissionState | null>(null);
  const [level, setLevel] = useState<DeckBloomLevel>("Remember");
  const [debug, setDebug] = useState<MissionComposition["debug"] | null>(null);
  const [srs, setSrs] = useState<SRSPerformance>({});
  const [xp, setXp] = useState<ReturnType<typeof initXpLedger> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await cardsRepo.listByDeck(deckId);
      if (!mounted) return;
      setCards(loaded);
      const { progress: prog, xp } = await fetchProgress(deckId);
      if (prog) {
        setProgress(prog);
      } else {
        const init = initUserBloomProgress(loaded);
        setProgress(init);
        await saveProgressRepo(deckId, init, undefined);
      }
      setXp(xp ?? initXpLedger());
      const s = await fetchSrs(deckId);
      setSrs(s);
    })();
    return () => { mounted = false; };
  }, [deckId]);

  useEffect(() => {
    if (!progress) return;
    const firstUnmastered = (BLOOM_LEVELS as DeckBloomLevel[]).find((lvl) => !progress[lvl]?.mastered) ?? "Create";
    setLevel(firstUnmastered);
  }, [progress]);

  useEffect(() => {
    (async () => {
      if (!progress) return;
      const mi = progress[level]?.missionsCompleted ?? 0;
      const existing = await fetchMission(deckId, level, mi);
      if (existing) {
        // If resuming Remember, strip any unsupported card types left from older compositions
        if (level === "Remember" && cards && cards.length > 0) {
          const allowed = new Set(
            cards
              .filter((c) => c.type === "Standard MCQ" || c.type === "Fill in the Blank")
              .map((c) => c.id)
          );
          const filteredOrder = existing.cardOrder.filter((id) => allowed.has(id));
          const filteredAnswered = existing.answered.filter((a) => allowed.has(a.cardId));
          const changed =
            filteredOrder.length !== existing.cardOrder.length ||
            filteredAnswered.length !== existing.answered.length;
          const resumed = resumeMission({ ...existing, cardOrder: filteredOrder, answered: filteredAnswered, correctCount: filteredAnswered.filter((a) => a.correct).length });
          setMission(resumed);
          if (changed) await upsertMission(deckId, resumed);
        } else {
          setMission(resumeMission(existing));
        }
      }
    })();
  }, [deckId, level, progress, cards]);

  const missionIndex = useMemo(() => progress?.[level]?.missionsCompleted ?? 0, [progress, level]);

  const startOrResume = useCallback(async () => {
    if (!cards || !progress) return;
    if (mission) return;
    const existing = await fetchMission(deckId, level, missionIndex);
    if (existing) {
      setMission(resumeMission(existing));
      return;
    }
  // Allow any card format; missions are composed by Bloom level, not type
  const isActive = () => true;
    const comp = composeMission({ deckId, level, allCards: cards, srs, missionIndex, seed: `${deckId}:${level}:${missionIndex}`, isActive });
    setDebug(comp.debug);
    const state = startMission({ deckId, level, missionIndex, poolIds: comp.missionIds, seed: comp.seedUsed });
    setMission(state);
    await upsertMission(deckId, state);
    await logXpEvent(deckId, level, "mission_started", { missionIndex, total: state.cardOrder.length });
  }, [cards, progress, mission, deckId, level, missionIndex, srs]);

  const restart = useCallback(async () => {
    if (!cards) return;
    const nextSeed = `${deckId}:${level}:${missionIndex}:${Date.now()}`;
  const isActive = () => true;
    const comp = composeMission({ deckId, level, allCards: cards, srs, missionIndex, seed: nextSeed, isActive });
    setDebug(comp.debug);
    const state = startMission({ deckId, level, missionIndex, poolIds: comp.missionIds, seed: comp.seedUsed });
    setMission(state);
    await upsertMission(deckId, state);
  }, [cards, deckId, level, missionIndex, srs]);

  const finish = useCallback(async () => {
    if (!mission || !progress || !xp) return;
    const res = computePass(mission);
    const before = progress[level].completedCards;
    const total = progress[level].totalCards;
    const afterCompleted = Math.min(total, before + mission.cardOrder.length);

    const copy: UserBloomProgress = { ...progress } as UserBloomProgress;
    copy[level] = {
      ...copy[level],
      completedCards: afterCompleted,
      missionsCompleted: copy[level].missionsCompleted + 1,
      masteryPercent: copy[level].masteryPercent,
      accuracySum: (copy[level].accuracySum ?? 0) + (res.total > 0 ? res.correct / res.total : 0),
      accuracyCount: (copy[level].accuracyCount ?? 0) + 1,
    };

    const BASE_XP: Record<DeckBloomLevel, number> = { Remember: 10, Understand: 12, Apply: 14, Analyze: 16, Evaluate: 18, Create: 20 };
    const MULT: Record<DeckBloomLevel, number> = { Remember: 1.0, Understand: 1.25, Apply: 1.5, Analyze: 2.0, Evaluate: 2.5, Create: 3.0 };
    const acc = res.total > 0 ? res.correct / res.total : 0;
    const deltaLevelCompletion = Math.max(0, Math.min(1, (afterCompleted - before) / Math.max(1, total)));
    const bloomAdded = BASE_XP[level] * acc * deltaLevelCompletion;
    const xpCopy = { ...xp, bloomXp: { ...xp.bloomXp }, commanderXp: { ...xp.commanderXp }, commanderGranted: { ...xp.commanderGranted } };
    xpCopy.bloomXp[level] = (xpCopy.bloomXp[level] ?? 0) + bloomAdded;
    let commanderAdded = 0;
    if (copy[level].mastered) {
      commanderAdded = bloomAdded * MULT[level];
      xpCopy.commanderXp[level] = (xpCopy.commanderXp[level] ?? 0) + commanderAdded;
      xpCopy.commanderXpTotal += commanderAdded;
    }

    const now = new Date().toISOString();
    await upsertSrs(deckId, srs);
    await upsertMission(deckId, { ...mission, completedAt: now });
    await saveProgressRepo(deckId, copy, xpCopy);
    await logXpEvent(deckId, level, "mission_completed", { percent: res.percent, correct: res.correct, total: res.total });
    if (bloomAdded > 0) await logXpEvent(deckId, level, "xp_bloom_added", { amount: bloomAdded });
    if (commanderAdded > 0) await logXpEvent(deckId, level, "xp_commander_added", { amount: commanderAdded });

    setProgress(copy);
    setXp(xpCopy);
    setMission(null);
  }, [mission, progress, xp, deckId, level, srs]);

  useEffect(() => {
    (async () => {
      if (!mission) return;
      const nextId = mission.cardOrder.find((id) => !mission.answered.some((a) => a.cardId === id));
      if (!nextId) await finish();
    })();
  }, [mission, finish]);

  useEffect(() => { void startOrResume(); }, [startOrResume]);

  return (
    <main className="study-page container mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="font-valid text-2xl font-semibold text-slate-900">Quest Mode · {level}</h1>
        <p className="font-valid text-sm text-slate-600">Deck #{deckId} · Mission {missionIndex + 1}</p>
      </div>
      {progress && (
        <div className="mb-6">
          <QuestProgress
            current={Math.min(progress[level].completedCards, progress[level].totalCards)}
            total={progress[level].totalCards}
            color={BLOOM_COLOR_HEX[level]}
            label={`${level} Progress`}
          />
        </div>
      )}
      {debug && (
        <div className="mb-2 text-xs text-slate-600">Primary: {debug.primaryCount} • Blasts {debug.blastsChosen}/{debug.blastsRequested} • Review {debug.reviewChosen}/{debug.reviewRequested} • Trimmed: B {debug.trimmedFromBlasts} / R {debug.trimmedFromReview} • Total: {debug.total}</div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="study-card p-6 md:p-8">
            <div className="study-body">
            {mission && cards ? (
              (() => {
                const currentCardId = mission.cardOrder.find((id) => !mission.answered.some((a) => a.cardId === id));
                if (!currentCardId) return <div className="text-slate-600">All questions answered.</div>;
                const card = cards.find((c) => c.id === currentCardId);
                if (!card) return null;
                if (card.type === "Standard MCQ") {
                  const mcq = card as DeckStandardMCQ;
                  const opts = [
                    { key: "A" as const, text: mcq.meta.options.A },
                    { key: "B" as const, text: mcq.meta.options.B },
                    { key: "C" as const, text: mcq.meta.options.C },
                    { key: "D" as const, text: mcq.meta.options.D },
                  ];
                  return (
                    <MCQStudy
                      prompt={mcq.question}
                      options={opts}
                      answerKey={mcq.meta.answer}
                      explanation={mcq.explanation}
                      onAnswer={async ({ correct, chosen }) => {
                        const updated = recordAnswer(mission, card.id, correct);
                        setMission(updated);
                        await upsertMission(deckId, updated);
                        const now = new Date().toISOString();
                        setSrs((prev) => {
                          const cur = prev[card.id] ?? { attempts: 0, correct: 0, lastSeenAt: undefined };
                          const next = { ...prev, [card.id]: { attempts: cur.attempts + 1, correct: cur.correct + (correct ? 1 : 0), lastSeenAt: now } };
                          void upsertSrs(deckId, next);
                          return next;
                        });
                        await logXpEvent(deckId, level, "card_answered", { cardId: card.id, correct, choice: chosen });
                      }}
                    />
                  );
                }
                if (card.type === "Fill in the Blank") {
                  const meta = card.meta as DeckFillMeta;
                  const isV2 = (m: DeckFillMeta): m is DeckFillMetaV2 => (m as DeckFillMetaV2).answers !== undefined && (m as DeckFillMetaV2).mode !== undefined;
                  const isV3 = (m: DeckFillMeta): m is DeckFillMetaV3 => (m as DeckFillMetaV3).blanks !== undefined;
                  const isV1 = (m: DeckFillMeta): m is { answer: string } => typeof (m as Record<string, unknown>)["answer"] === "string";
                  let stem = card.question;
                  let blanks: { id: string | number; answers: string[]; hint?: string; mode?: "bank" | "free" | "either"; caseSensitive?: boolean; ignorePunct?: boolean }[] = [];
                  let wordBank: string[] | undefined = undefined;
                  if (isV3(meta)) {
                    blanks = meta.blanks.map((b) => ({
                      id: b.id,
                      answers: b.answers,
                      hint: b.hint,
                      mode: b.mode === "Drag & Drop" ? "bank" : b.mode === "Free Text" ? "free" : "either",
                      caseSensitive: b.caseSensitive ?? meta.caseSensitive,
                      ignorePunct: b.ignorePunct ?? meta.ignorePunct,
                    }));
                    wordBank = meta.options;
                    const tagRe = /\[\[(\d+)\]\]/g;
                    const countTags = [...(stem.matchAll(tagRe))].length;
                    if (countTags < blanks.length) {
                      stem = `${stem}${Array.from({ length: blanks.length - countTags }, (_ , i) => ` [[${countTags + i + 1}]]`).join("")}`;
                    }
                  } else if (isV2(meta)) {
                    const answers = meta.answers;
                    const tagRe = /\[\[(\d+)\]\]/g;
                    const existingTags = [...(stem.matchAll(tagRe))].length;
                    if (existingTags < answers.length) {
                      stem = `${stem}${Array.from({ length: answers.length - existingTags }, (_ , i) => ` [[${existingTags + i + 1}]]`).join("")}`;
                    }
                    blanks = answers.map((a, idx) => ({ id: String(idx + 1), answers: [a], mode: meta.mode === "Drag & Drop" ? "bank" : "free" }));
                    wordBank = meta.options;
                  } else if (isV1(meta)) {
                    const legacy = meta.answer;
                    if (legacy) {
                      if (!/\[\[(\d+)\]\]/.test(stem)) stem = `${stem} [[1]]`;
                      blanks = [{ id: "1", answers: [legacy] }];
                    }
                  }
                  if ((!wordBank || wordBank.length === 0) && isV3(meta) && (meta.mode === "Either" || meta.mode === "Drag & Drop")) {
                    const uniq = new Set<string>();
                    blanks.forEach((b) => b.answers.forEach((a) => uniq.add(a)));
                    wordBank = Array.from(uniq);
                  }
                  return (
                    <FillBlankStudy
                      stem={stem}
                      blanks={blanks}
                      wordBank={wordBank}
                      explanation={card.explanation}
                      onAnswer={async ({ perBlank, allCorrect, filledText }) => {
                        const correct = allCorrect;
                        const updated = recordAnswer(mission, card.id, correct);
                        setMission(updated);
                        await upsertMission(deckId, updated);
                        const now = new Date().toISOString();
                        setSrs((prev) => {
                          const cur = prev[card.id] ?? { attempts: 0, correct: 0, lastSeenAt: undefined };
                          const next = { ...prev, [card.id]: { attempts: cur.attempts + 1, correct: cur.correct + (correct ? 1 : 0), lastSeenAt: now } };
                          void upsertSrs(deckId, next);
                          return next;
                        });
                        await logXpEvent(deckId, level, "card_answered", { cardId: card.id, correct, perBlank, filledText });
                      }}
                    />
                  );
                }
                return (
                  <div className="rounded border border-slate-200 p-4 text-slate-700">This card type is not yet implemented for Quest UI.</div>
                );
              })()
            ) : (
              <div className="text-slate-600">Loading mission…</div>
            )}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="font-valid px-3 py-2 bg-gray-600 text-white rounded-full" onClick={restart} disabled={!mission}>Restart</button>
            <button className="font-valid px-3 py-2 bg-slate-200 rounded-full" onClick={() => router.push(`/decks/${deckId}/study`)}>Back</button>
          </div>
        </div>
        <div className="lg:col-span-4">
          <AgentCard displayName="You" level={1} tokens={0} />
        </div>
      </div>
    </main>
  );
}
