"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as cardsRepo from "@/lib/cardsRepo";
import type { DeckBloomLevel, DeckCard, DeckStandardMCQ, DeckFillMeta, DeckFillMetaV2, DeckFillMetaV3, DeckShortAnswer, DeckSortingMeta, DeckCompareContrastMeta, DeckTwoTierMCQ, DeckCER, DeckCERMeta } from "@/types/deck-cards";
import { BLOOM_LEVELS, BLOOM_COLOR_HEX, defaultBloomFor as defaultBloomForTypeCatalog } from "@/types/card-catalog";
import { startMission, resumeMission, recordAnswer, computePass, initUserBloomProgress, composeMission, initXpLedger } from "@/lib/quest/engine";
import { updateCardMastery } from "@/lib/mastery";
import type { ReviewOutcome, CardMastery } from "@/types/mastery";
import { Bloom } from "@/lib/bloom";
import type { MissionState, SRSPerformance, UserBloomProgress, MissionComposition } from "@/lib/quest/types";
// import { DEFAULT_QUEST_SETTINGS } from "@/lib/quest/types";
import AgentCard from "@/components/AgentCard";
import { QuestProgress } from "@/components/QuestProgress";
import MCQStudy from "@/components/cards/MCQStudy";
import FillBlankStudy from "@/components/cards/FillBlankStudy";
import SequencingStudy from "@/components/cards/SequencingStudy";
import { fetchProgress, saveProgressRepo, fetchMission, upsertMission, fetchSrs, upsertSrs, logXpEvent } from "@/lib/quest/repo";
import { loadUserCardState, upsertUserCardState } from "@/lib/masteryRepo";
import { getSupabaseClient } from "@/lib/supabase/browserClient";
// review-candidates now provided by server via API
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors, rectIntersection } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";

export default function QuestClient({ deckId }: { deckId: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [progress, setProgress] = useState<UserBloomProgress | null>(null);
  const [mission, setMission] = useState<MissionState | null>(null);
  // Initialize level from URL to avoid flashing Remember before progress loads
  const spInitial = (sp?.get("level") ?? "") as DeckBloomLevel;
  const spInitialValid = (BLOOM_LEVELS as DeckBloomLevel[]).includes(spInitial as DeckBloomLevel);
  const [level, setLevel] = useState<DeckBloomLevel>(spInitialValid ? spInitial : "Remember");
  const [levelReady, setLevelReady] = useState<boolean>(spInitialValid);
  const [debug, setDebug] = useState<MissionComposition["debug"] | null>(null);
  const [compositionIds, setCompositionIds] = useState<Pick<MissionComposition, "primaryIds" | "blastsIds" | "reviewIds"> | null>(null);
  const [srs, setSrs] = useState<SRSPerformance>({});
  const [xp, setXp] = useState<ReturnType<typeof initXpLedger> | null>(null);
  const [deckTitle, setDeckTitle] = useState<string>(`Deck #${deckId}`);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("Agent");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [reviewCandidateIds, setReviewCandidateIds] = useState<number[] | null>(null);
  const finishingRef = React.useRef(false);
  // Queue the current card's answer until user presses Continue
  const pendingRef = React.useRef<{
    cardId: number;
    // legacy boolean or fractional 0..1
    correct: boolean | number;
    payload?: Record<string, unknown>;
    telemetry?: { responseMs?: number; confidence?: 0|1|2|3; guessed?: boolean; cardType?: string };
  } | null>(null);
  // Short Answer UI state (mirrors view-card modal)
  const [saText, setSaText] = useState("");
  const [saChecked, setSaChecked] = useState(false);
  const [saJudged, setSaJudged] = useState<null | "yes" | "no">(null);
  const saStartRef = React.useRef<number>(Date.now());
  const [saResponseMs, setSaResponseMs] = useState<number | undefined>(undefined);
  // Sorting UI state (mirrors view-card modal)
  const [sortAssignments, setSortAssignments] = useState<Record<string, string>>({}); // term -> category
  const [sortChecked, setSortChecked] = useState(false);
  const [sortAllCorrect, setSortAllCorrect] = useState<boolean | null>(null);
  const [sortConfidence, setSortConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [sortGuessed, setSortGuessed] = useState(false);
  const [sortShowCorrect, setSortShowCorrect] = useState(false);
  const sortAttemptRef = React.useRef<Record<string, string> | null>(null);
  const sortStartRef = React.useRef<number>(Date.now());
  const [sortResponseMs, setSortResponseMs] = useState<number | undefined>(undefined);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  // Short Answer telemetry
  const [saConfidence, setSaConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [saGuessed, setSaGuessed] = useState(false);
  // Compare/Contrast UI state (mirrors view-card modal)
  const [ccA, setCcA] = useState<Record<number, string>>({});
  const [ccB, setCcB] = useState<Record<number, string>>({});
  const [ccChecked, setCcChecked] = useState(false);
  const [ccAllCorrect, setCcAllCorrect] = useState<boolean | null>(null);
  const [ccOverride, setCcOverride] = useState<Record<number, "right" | "wrong" | undefined>>({});
  const [ccConfidence, setCcConfidence] = useState<0|1|2|3|undefined>(undefined);
  const [ccGuessed, setCcGuessed] = useState(false);
  const ccStartRef = React.useRef<number>(Date.now());
  const [ccResponseMs, setCcResponseMs] = useState<number | undefined>(undefined);

  // Two-Tier MCQ UI state (binary scoring in quests)
  const [ttTier1, setTtTier1] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [ttTier2, setTtTier2] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [ttChecked, setTtChecked] = useState(false);
  const ttStartRef = React.useRef<number>(Date.now());
  const [ttResponseMs, setTtResponseMs] = useState<number | undefined>(undefined);

  // CER UI state
  const [cerMCQSel, setCerMCQSel] = useState<{ claim: number | null; evidence: number | null; reasoning: number | null }>({ claim: null, evidence: null, reasoning: null });
  const [cerMCQChecked, setCerMCQChecked] = useState(false);
  const cerMCQStartRef = React.useRef<number>(Date.now());
  const [cerMCQResponseMs, setCerMCQResponseMs] = useState<number | undefined>(undefined);
  const [cerFree, setCerFree] = useState<{ claim: string; evidence: string; reasoning: string }>({ claim: "", evidence: "", reasoning: "" });
  const [cerFreeChecked, setCerFreeChecked] = useState(false);
  const [cerFreeOverride, setCerFreeOverride] = useState<{ claim?: "right" | "wrong"; evidence?: "right" | "wrong"; reasoning?: "right" | "wrong" }>({});
  const cerFreeStartRef = React.useRef<number>(Date.now());
  const [cerFreeResponseMs, setCerFreeResponseMs] = useState<number | undefined>(undefined);

  // Active predicate based on Bloom tag (card's explicit bloomLevel or default by type)
  const activePredicateForLevel = useCallback((lvl: DeckBloomLevel) => {
    return (c: DeckCard) => {
      const defaultBloom = defaultBloomForTypeCatalog(c.type) as unknown as DeckBloomLevel;
      const eff: DeckBloomLevel = (c.bloomLevel ?? defaultBloom) as DeckBloomLevel;
      return eff === lvl;
    };
  }, []);

  // helper: default state for a new card
  const freshState = useCallback((cardId: string, bloom: Bloom): CardMastery => ({
    cardId, bloom,
    srs: { ef: 2.5, reps: 0, intervalDays: 0, nextDueIso: new Date().toISOString(), history: [] },
    spacing: { spacedShortOk: false, spacedLongOk: false, consecutiveSpacedSuccesses: 0 },
    accuracy: { k: 6, ptr: -1, outcomes: [] },
    confidence: { ewma: 0.5, lambda: 0.6 },
    Ri: 0, Ai: 0, Ci: 0, Mi: 0,
    updatedIso: new Date().toISOString(),
  }), []);

  const handleMasteryUpdate = useCallback(async (uid: string, payload: {
    cardId: string;
    bloom: Bloom;
    correct: boolean;
    responseMs?: number;
    confidence?: 0|1|2|3;
    guessed?: boolean;
    cardType?: string;
  }) => {
    const outcome: ReviewOutcome = {
      correct: payload.correct,
      responseMs: payload.responseMs,
      confidence: payload.confidence,
      guessed: payload.guessed,
      cardType: payload.cardType,
    };

    const prev: CardMastery = (await loadUserCardState(uid, Number(payload.cardId), payload.bloom))
      ?? freshState(payload.cardId, payload.bloom);

    const next = updateCardMastery(prev, outcome);
  await upsertUserCardState(uid, Number(payload.cardId), next);

    // optional: hook for UI updates
    // emitProgressUpdate?.({ cardId: payload.cardId, Mi: next.Mi, Ri: next.Ri, Ai: next.Ai, Ci: next.Ci });
  }, [freshState]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await cardsRepo.listByDeck(deckId);
      if (!mounted) return;
      setCards(loaded);
      // Fetch deck title for header
      try {
        const supabase = getSupabaseClient();
  const [{ data: deck, error: deckErr }, { data: userResp }] = await Promise.all([
          supabase.from("decks").select("title").eq("id", deckId).maybeSingle(),
          supabase.auth.getUser(),
        ]);
        if (!deckErr && deck?.title) setDeckTitle(String(deck.title));
        if (userResp?.user?.id) setUserId(userResp.user.id);
        if (userResp?.user) {
          const meta = (userResp.user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string; picture?: string };
          const first = (meta.full_name || "").trim().split(/\s+/)[0] || (userResp.user.email?.split("@")[0] ?? "Agent");
          setUserDisplayName(first);
          setUserAvatarUrl(meta.avatar_url || meta.picture || null);
        }
      } catch {
        // ignore
      }
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

  // Fetch low-accuracy review candidates from server
  useEffect(() => {
    (async () => {
      if (!userId || !cards || cards.length === 0) { setReviewCandidateIds(null); return; }
      try {
        const res = await fetch(`/api/quest/${deckId}/review-candidates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardIds: cards.map(c => c.id) }),
        });
        if (!res.ok) { setReviewCandidateIds(null); return; }
        const j = await res.json().catch(() => null);
        const ids = (j && Array.isArray(j.ids)) ? (j.ids as number[]) : [];
        setReviewCandidateIds(ids);
      } catch {
        setReviewCandidateIds(null);
      }
    })();
  }, [userId, cards, deckId]);

  useEffect(() => {
    if (!progress) return;
    const override = (sp?.get("level") ?? "") as DeckBloomLevel;
    const isValidOverride = (BLOOM_LEVELS as DeckBloomLevel[]).includes(override as DeckBloomLevel);
    const firstUnmastered = (BLOOM_LEVELS as DeckBloomLevel[]).find((lvl) => !progress[lvl]?.mastered) ?? "Create";
  setLevel(isValidOverride ? override : firstUnmastered);
  setLevelReady(true);
  }, [progress, sp]);

  useEffect(() => {
    // Consolidated into startOrResume; this effect no longer fetches/resumes a mission to avoid races that skip the first card.
  }, [deckId, level, levelReady, progress, cards]);

  const restartRequested = useMemo(() => (sp?.get("restart") ?? "") === "1", [sp]);
  const missionIndex = useMemo(() => {
    const mi = progress?.[level]?.missionsCompleted ?? 0;
    return restartRequested ? 0 : mi;
  }, [progress, level, restartRequested]);
  const missionProgress = useMemo(() => {
    if (!mission) return { current: 0, total: 0 };
    const total = mission.cardOrder.length;
    const answered = mission.answered.length;
    return { current: Math.min(total, answered + 1), total };
  }, [mission]);

  // Track current card index and reset per-card UI + pending answer whenever it changes
  const lastIndexRef = React.useRef<number | null>(null);
  useEffect(() => {
    if (!mission) return;
    const curIndex = mission.answered.length;
    if (curIndex !== lastIndexRef.current) {
      // Clear any staged answer from the previous card to avoid auto-advance or stuck state
      pendingRef.current = null;
      // Reset Short Answer UI state
      setSaText("");
      setSaChecked(false);
      setSaJudged(null);
      saStartRef.current = Date.now();
      setSaResponseMs(undefined);
      setSaConfidence(undefined);
      setSaGuessed(false);
      // Reset Sorting UI state
      setSortAssignments({});
      setSortChecked(false);
      setSortAllCorrect(null);
      setSortConfidence(undefined);
      setSortGuessed(false);
  setSortShowCorrect(false);
  sortAttemptRef.current = null;
      sortStartRef.current = Date.now();
      setSortResponseMs(undefined);
  // Reset Compare/Contrast UI state
  setCcA({});
  setCcB({});
  setCcChecked(false);
  setCcAllCorrect(null);
  setCcOverride({});
  setCcConfidence(undefined);
  setCcGuessed(false);
  ccStartRef.current = Date.now();
  setCcResponseMs(undefined);
  // Reset Two-Tier MCQ state
  setTtTier1(null);
  setTtTier2(null);
  setTtChecked(false);
  setTtResponseMs(undefined);
  ttStartRef.current = Date.now();
  // Reset CER state
  setCerMCQSel({ claim: null, evidence: null, reasoning: null });
  setCerMCQChecked(false);
  setCerMCQResponseMs(undefined);
  cerMCQStartRef.current = Date.now();
  setCerFree({ claim: "", evidence: "", reasoning: "" });
  setCerFreeChecked(false);
  setCerFreeOverride({});
  setCerFreeResponseMs(undefined);
  cerFreeStartRef.current = Date.now();
      lastIndexRef.current = curIndex;
    }
  }, [mission]);

  const applyPendingAndAdvance = useCallback(async () => {
    if (!mission) return;
    const cur = pendingRef.current;
  if (!cur) return;
  // Guard: ensure the pending answer corresponds to the current unanswered card at the current index
  const idx = mission.answered.length;
  const nextId = mission.cardOrder[idx];
  if (typeof nextId === "number" && cur.cardId !== nextId) return;
    // Apply mission answer now
    const updated = recordAnswer(mission, cur.cardId, cur.correct);
    setMission(updated);
    await upsertMission(deckId, updated);
    const nowIso = new Date().toISOString();
    setSrs((prev) => {
      const perf = prev[cur.cardId] ?? { attempts: 0, correct: 0, lastSeenAt: undefined as string | undefined };
      const numeric = typeof cur.correct === "number" ? Math.max(0, Math.min(1, cur.correct)) : cur.correct ? 1 : 0;
      const next = { ...prev, [cur.cardId]: { attempts: perf.attempts + 1, correct: perf.correct + numeric, lastSeenAt: nowIso } };
      void upsertSrs(deckId, next);
      return next;
    });
    // Removed per-card stats API call
    await logXpEvent(deckId, level, "card_answered", cur.payload ?? {});
    if (userId && cur.telemetry) {
      const bloomEnum = Bloom[level as keyof typeof Bloom];
      // Mastery pipeline expects boolean correct. Treat fractional >0.5 as correct.
      const masteryCorrect = typeof cur.correct === "number" ? cur.correct > 0.5 : cur.correct;
      await handleMasteryUpdate(userId, { cardId: String(cur.cardId), bloom: bloomEnum, correct: masteryCorrect, ...cur.telemetry });
    }
    pendingRef.current = null;
    // If no more unanswered, finishing effect will run
  }, [mission, deckId, level, userId, handleMasteryUpdate]);

  const startOrResume = useCallback(async () => {
    if (!cards || !progress) return;
    if (mission) return;
  // Create level is not yet supported
  if (level === "Create") return;
  // Block missions with zero eligible cards for this level
  const isActiveCheck = activePredicateForLevel(level);
  const eligibleCount = (cards || []).filter(isActiveCheck).length;
  if (eligibleCount === 0) return;
  finishingRef.current = false;
    // If restart was explicitly requested, ignore existing mission data and compose fresh from missionIndex (0)
    if (!restartRequested) {
      const existing = await fetchMission(deckId, level, missionIndex);
    if (existing) {
        if (cards && cards.length) {
          // Resume as-is; composition rules (including blasts/reviews) are handled by the engine.
          const trimmed = existing;
          const allAnswered = trimmed.answered.length >= trimmed.cardOrder.length;
          if (!allAnswered && trimmed.cardOrder.length > 0) {
      // Clear any staged answer from a prior session before resuming
      pendingRef.current = null;
  // Reset per-card UI state when (re)starting a mission
      setSaText(""); setSaChecked(false); setSaJudged(null); saStartRef.current = Date.now(); setSaResponseMs(undefined); setSaConfidence(undefined); setSaGuessed(false);
      setSortAssignments({}); setSortChecked(false); setSortAllCorrect(null); setSortConfidence(undefined); setSortGuessed(false); sortStartRef.current = Date.now(); setSortResponseMs(undefined);
  setSortShowCorrect(false); sortAttemptRef.current = null;
  setCcA({}); setCcB({}); setCcChecked(false); setCcAllCorrect(null); setCcOverride({}); setCcConfidence(undefined); setCcGuessed(false); ccStartRef.current = Date.now(); setCcResponseMs(undefined);
  // Reset Two-Tier MCQ and CER UI state when resuming
  setTtTier1(null); setTtTier2(null); setTtChecked(false); setTtResponseMs(undefined); ttStartRef.current = Date.now();
  setCerMCQSel({ claim: null, evidence: null, reasoning: null }); setCerMCQChecked(false); setCerMCQResponseMs(undefined); cerMCQStartRef.current = Date.now();
  setCerFree({ claim: "", evidence: "", reasoning: "" }); setCerFreeChecked(false); setCerFreeOverride({}); setCerFreeResponseMs(undefined); cerFreeStartRef.current = Date.now();
  // Recompute composition ids so we can label current card
    try {
  const isActiveLocal = activePredicateForLevel(level);
  const comp = composeMission({ deckId, level, allCards: cards, srs, missionIndex, seed: `${deckId}:${level}:${missionIndex}`, isActive: isActiveLocal, reviewCandidateIds: reviewCandidateIds ?? undefined });
        setDebug(comp.debug);
        setCompositionIds({ primaryIds: comp.primaryIds, blastsIds: comp.blastsIds, reviewIds: comp.reviewIds });
      } catch {}
      setMission(resumeMission(trimmed));
            await upsertMission(deckId, trimmed);
            return;
          }
        }
      // If we reach here, existing is stale/complete; fall through to compose fresh
      }
    }
    // Allow only supported card types for this level; engine will add blasts/review
  const isActiveLocal2 = activePredicateForLevel(level);
  const comp = composeMission({ deckId, level, allCards: cards, srs, missionIndex, seed: `${deckId}:${level}:${missionIndex}`, isActive: isActiveLocal2, reviewCandidateIds: reviewCandidateIds ?? undefined });
    // Safety: if overlaps with previously answered (due to old data), remove answered cardIds
    const previously = restartRequested ? null : await fetchMission(deckId, level, missionIndex);
    const answeredIds = new Set((previously?.answered ?? []).map((a) => a.cardId));
    let missionIds = comp.missionIds.filter((id) => !answeredIds.has(id));
    if (missionIds.length === 0) {
      // Stale overlap: start fresh
      missionIds = comp.missionIds;
    }
  setDebug(comp.debug);
  setCompositionIds({ primaryIds: comp.primaryIds, blastsIds: comp.blastsIds, reviewIds: comp.reviewIds });
    const state = startMission({ deckId, level, missionIndex, poolIds: missionIds, seed: comp.seedUsed });
    // Clear any staged answer and reset UI state for a clean start
    pendingRef.current = null;
  setSaText(""); setSaChecked(false); setSaJudged(null); saStartRef.current = Date.now(); setSaResponseMs(undefined); setSaConfidence(undefined); setSaGuessed(false);
  setSortAssignments({}); setSortChecked(false); setSortAllCorrect(null); setSortConfidence(undefined); setSortGuessed(false); setSortShowCorrect(false); sortAttemptRef.current = null; sortStartRef.current = Date.now(); setSortResponseMs(undefined);
  setCcA({}); setCcB({}); setCcChecked(false); setCcAllCorrect(null); setCcOverride({}); setCcConfidence(undefined); setCcGuessed(false); ccStartRef.current = Date.now(); setCcResponseMs(undefined);
  setTtTier1(null); setTtTier2(null); setTtChecked(false); setTtResponseMs(undefined); ttStartRef.current = Date.now();
  setCerMCQSel({ claim: null, evidence: null, reasoning: null }); setCerMCQChecked(false); setCerMCQResponseMs(undefined); cerMCQStartRef.current = Date.now();
  setCerFree({ claim: "", evidence: "", reasoning: "" }); setCerFreeChecked(false); setCerFreeOverride({}); setCerFreeResponseMs(undefined); cerFreeStartRef.current = Date.now();
    setMission(state);
    await upsertMission(deckId, state);
    await logXpEvent(deckId, level, "mission_started", { missionIndex, total: state.cardOrder.length });
    // Clear the restart flag from URL so refreshes don't re-trigger
    if (restartRequested) {
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete("restart");
        router.replace(u.pathname + (u.search ? u.search : ""));
      } catch {}
    }
  }, [cards, progress, mission, deckId, level, missionIndex, srs, restartRequested, router, activePredicateForLevel, reviewCandidateIds]);

  const restart = useCallback(async () => {
    if (!cards) return;
  finishingRef.current = false;
    // Prevent restart when no eligible cards or Create level
    if (level === "Create") return;
  const isActiveCheck2 = activePredicateForLevel(level);
  const eligibleCount = (cards || []).filter(isActiveCheck2).length;
    if (eligibleCount === 0) return;
    const nextSeed = `${deckId}:${level}:${missionIndex}:${Date.now()}`;
  const isActiveLocal3 = activePredicateForLevel(level);
  const comp = composeMission({ deckId, level, allCards: cards, srs, missionIndex, seed: nextSeed, isActive: isActiveLocal3, reviewCandidateIds: reviewCandidateIds ?? undefined });
  setDebug(comp.debug);
  setCompositionIds({ primaryIds: comp.primaryIds, blastsIds: comp.blastsIds, reviewIds: comp.reviewIds });
    const state = startMission({ deckId, level, missionIndex, poolIds: comp.missionIds, seed: comp.seedUsed });
  setMission(state);
    await upsertMission(deckId, state);
  // Reset per-card UI state on restart
  setSaText(""); setSaChecked(false); setSaJudged(null); saStartRef.current = Date.now(); setSaResponseMs(undefined); setSaConfidence(undefined); setSaGuessed(false);
  setSortAssignments({}); setSortChecked(false); setSortAllCorrect(null); setSortConfidence(undefined); setSortGuessed(false); setSortShowCorrect(false); sortAttemptRef.current = null; sortStartRef.current = Date.now(); setSortResponseMs(undefined);
  setCcA({}); setCcB({}); setCcChecked(false); setCcAllCorrect(null); setCcOverride({}); setCcConfidence(undefined); setCcGuessed(false); ccStartRef.current = Date.now(); setCcResponseMs(undefined);
  setTtTier1(null); setTtTier2(null); setTtChecked(false); setTtResponseMs(undefined); ttStartRef.current = Date.now();
  setCerMCQSel({ claim: null, evidence: null, reasoning: null }); setCerMCQChecked(false); setCerMCQResponseMs(undefined); cerMCQStartRef.current = Date.now();
  setCerFree({ claim: "", evidence: "", reasoning: "" }); setCerFreeChecked(false); setCerFreeOverride({}); setCerFreeResponseMs(undefined); cerFreeStartRef.current = Date.now();
  }, [cards, deckId, level, missionIndex, srs, activePredicateForLevel, reviewCandidateIds]);

  const finish = useCallback(async () => {
    if (finishingRef.current) return null as null | { unlocked: boolean; percent: number; total: number; correct: number; level: DeckBloomLevel };
    finishingRef.current = true;
    if (!mission || !progress || !xp) return null as null | { unlocked: boolean; percent: number; total: number; correct: number; level: DeckBloomLevel };
    const res = computePass(mission);
    const before = progress[level].completedCards;
    const total = progress[level].totalCards;
    const afterCompleted = Math.min(total, before + mission.cardOrder.length);

    const copy: UserBloomProgress = { ...progress } as UserBloomProgress;
    // Update base counters and single-pass unlock
    const prev = copy[level];
    const acc01 = res.total > 0 ? res.correct / res.total : 0;
  // Use raw pass/fail from computePass (based on raw float + epsilon), not display percent
  const clearedNow = res.passed;
    copy[level] = {
      ...prev,
      completedCards: afterCompleted,
      missionsCompleted: prev.missionsCompleted + 1,
      masteryPercent: prev.masteryPercent,
      accuracySum: (prev.accuracySum ?? 0) + acc01,
      accuracyCount: (prev.accuracyCount ?? 0) + 1,
      cleared: prev.cleared || clearedNow,
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
  // Do not write per_bloom/xp here to avoid double-counting; server /complete will aggregate and persist
    await logXpEvent(deckId, level, "mission_completed", { percent: res.percent, correct: res.correct, total: res.total });
    if (bloomAdded > 0) await logXpEvent(deckId, level, "xp_bloom_added", { amount: bloomAdded });
    if (commanderAdded > 0) await logXpEvent(deckId, level, "xp_commander_added", { amount: commanderAdded });

    // Server-side: record attempt, unlock next, and update mastery aggregates
    let unlockedFromComplete: boolean | null = null;
    try {
      const resp = await fetch(`/api/quest/${deckId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bloom_level: level,
          score_pct: res.percent,
          cards_seen: res.total,
          cards_correct: res.correct,
          started_at: mission.startedAt,
          ended_at: now,
        }),
      });
      if (resp.ok) {
        const j = await resp.json().catch(() => null);
        if (j && typeof j.unlocked !== "undefined") {
          unlockedFromComplete = Boolean(j.unlocked);
        }
      }
    } catch {}

  setProgress(copy);
  setXp(xpCopy);
    // Persist XP ledger to server (merge-only)
    try {
      await saveProgressRepo(deckId, undefined, xpCopy);
    } catch {}
    setMission(null);
  return { unlocked: Boolean(unlockedFromComplete ?? res.passed), percent: res.percent, total: res.total, correct: res.correct, level };
  }, [mission, progress, xp, deckId, level, srs]);

  useEffect(() => {
    (async () => {
      if (!mission) return;
    const idx = mission.answered.length;
    const nextId = mission.cardOrder[idx];
  if (typeof nextId === "undefined") {
        const summary = await finish();
        // Redirect to mission-complete page with deckId and mode hint, and completion hints
        try {
          const params = new URLSearchParams();
          params.set("mode", "quest");
          if (summary) {
            params.set("level", summary.level);
            params.set("unlocked", summary.unlocked ? "1" : "0");
            params.set("pct", String(Math.round(summary.percent * 10) / 10));
            params.set("total", String(summary.total));
            params.set("correct", String(summary.correct));
          }
          router.push(`/decks/${deckId}/mission-complete?${params.toString()}`);
        } catch {}
      }
    })();
  }, [mission, finish, deckId, router]);

  useEffect(() => { void startOrResume(); }, [startOrResume]);

  return (
    <main className="study-page container mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="font-valid text-2xl font-semibold text-slate-900">Quest Mode · {level}</h1>
        <p className="font-valid text-sm text-slate-600">{deckTitle} · Mission {missionIndex + 1}</p>
      </div>
      {level === "Create" ? (
        <div className="mb-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
            Create level missions are coming soon.
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <QuestProgress current={missionProgress.current} total={missionProgress.total} color={BLOOM_COLOR_HEX[level]} label={`${level} Progress`} />
          {mission ? (
            <p className="mt-1 text-xs text-slate-600">
              Cards this mission: {mission.cardOrder.length}
              {debug ? ` (Primary ${debug.primaryCount}, Blasts ${debug.blastsChosen}, Review ${debug.reviewChosen})` : ""}
            </p>
          ) : null}
        </div>
      )}
      {/* Friendly card label replaces raw debug breakdown */}
      {(() => {
        if (!mission || !compositionIds) return null;
        const currentIndex = mission.answered.length;
        const currentCardId = mission.cardOrder[currentIndex];
        if (typeof currentCardId !== "number") return null;
        const isPrimary = compositionIds.primaryIds.includes(currentCardId);
        const isBlast = compositionIds.blastsIds.includes(currentCardId);
        const isReview = compositionIds.reviewIds.includes(currentCardId);
        let label = "";
        if (isPrimary) label = "Core mission"; // optional: could be blank
        else if (isBlast) label = "Blasts from the pasts: random re-encounters";
        else if (isReview) label = "Review weak spots";
        if (!label && isPrimary === false && (isBlast || isReview)) label = isBlast ? "Blasts from the pasts: random re-encounters" : "Review weak spots";
        if (!label) label = "";
        return label ? <div className="mb-2 text-sm text-slate-700">{label}</div> : null;
      })()}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="study-card p-6 md:p-8">
            <div className="study-body">
      {level === "Create" ? (
                <div className="rounded border border-slate-200 p-4 text-slate-700">Create level content is coming soon.</div>
              ) : mission && cards ? (
              (() => {
        const currentIndex = mission.answered.length;
        const currentCardId = mission.cardOrder[currentIndex];
        if (typeof currentCardId === "undefined") return <div className="text-slate-600">All questions answered.</div>;
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
                      key={card.id}
                      prompt={mcq.question}
                      options={opts}
                      answerKey={mcq.meta.answer}
                      explanation={mcq.explanation}
                      onAnswer={({ correct, chosen, responseMs, confidence, guessed }) => {
                        pendingRef.current = {
                          cardId: card.id,
                          correct,
                          payload: { cardId: card.id, correct, choice: chosen },
                          telemetry: { responseMs, confidence, guessed, cardType: card.type },
                        };
                      }}
                      onContinue={applyPendingAndAdvance}
                    />
                  );
                }
                if (card.type === "Short Answer") {
                  const sa = card as DeckShortAnswer;
                  return (
                    <div className="w-full">
                      <h2 className="text-2xl font-semibold mb-4 text-slate-900">{sa.question}</h2>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        rows={4}
                        placeholder="Type your answer..."
                        value={saText}
                        onChange={(e) => { if (!saChecked) setSaText(e.target.value); }}
                        readOnly={saChecked}
                      />
                      {!saChecked && (
                        <div className="mt-3 flex items-center gap-3">
                          <label className="text-sm text-slate-600" htmlFor="sa-confidence">Confidence</label>
                          <select id="sa-confidence" value={saConfidence ?? ""} onChange={(e) => setSaConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
                            <option value="">-</option>
                            <option value={0}>0</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                          </select>
                          <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={saGuessed} onChange={(e) => setSaGuessed(e.target.checked)} />Guessed</label>
                        </div>
                      )}
                      <div className="mt-4">
                        {!saChecked ? (
                          <button
                            type="button"
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
                            onClick={() => { setSaChecked(true); setSaResponseMs(Date.now() - saStartRef.current); }}
                            disabled={saText.trim().length === 0}
                          >
                            Check Answer
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div className="rounded-lg bg-slate-50 p-4">
                              <div className="font-semibold text-slate-900 mb-1">Suggested answer</div>
                              <div className="text-slate-800 font-semibold">{sa.meta.suggestedAnswer || "No suggested answer."}</div>
                              {sa.explanation ? <div className="mt-3 text-sm text-slate-600">{sa.explanation}</div> : null}
                            </div>
                            {saJudged == null ? (
                              <div className="flex items-center justify-between">
                                <div className="text-slate-700 font-medium">Did you get it right?</div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSaJudged("yes");
                                      pendingRef.current = {
                                        cardId: sa.id,
                                        correct: true,
                                        payload: { cardId: sa.id, correct: true, selfMark: true },
                                        telemetry: { responseMs: saResponseMs, confidence: saConfidence, guessed: saGuessed, cardType: sa.type },
                                      };
                                    }}
                                    className="group inline-flex items-center gap-2 rounded-lg border border-green-500 px-3 py-2 text-green-600 hover:bg-green-500 hover:text-white transition-colors"
                                  >
                                    <svg className="h-5 w-5 text-green-600 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSaJudged("no");
                                      pendingRef.current = {
                                        cardId: sa.id,
                                        correct: false,
                                        payload: { cardId: sa.id, correct: false, selfMark: true },
                                        telemetry: { responseMs: saResponseMs, confidence: saConfidence, guessed: saGuessed, cardType: sa.type },
                                      };
                                    }}
                                    className="group inline-flex items-center gap-2 rounded-lg border border-red-500 px-3 py-2 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                                  >
                                    <svg className="h-5 w-5 text-red-600 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    No
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${saJudged === "yes" ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                                <div className="font-semibold">{saJudged === "yes" ? "Correct!" : "Not quite"}</div>
                                <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${saJudged === "yes" ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={applyPendingAndAdvance}>
                                  Continue
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
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
                      onAnswer={({ perBlank, allCorrect, filledText, responseMs, confidence, guessed }) => {
                        pendingRef.current = {
                          cardId: card.id,
                          correct: allCorrect,
                          payload: { cardId: card.id, correct: allCorrect, perBlank, filledText },
                          telemetry: { responseMs, confidence, guessed, cardType: card.type },
                        };
                      }}
                      onContinue={applyPendingAndAdvance}
                    />
                  );
                }
                if (card.type === "Sorting") {
                  const meta = card.meta as DeckSortingMeta;
                  const categories = meta.categories;
                  const items = meta.items.map((it) => it.term);
                  const disabled = sortChecked;

                  function DraggableChip({ id, text }: { id: string; text: string }) {
                    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
                    const style: React.CSSProperties = { transform: CSS.Translate.toString(transform) };
                    // After check, color by correctness
                    let chipClass = "";
                    if (sortChecked) {
                      const correctByTerm: Record<string, string> = {};
                      for (const it of meta.items) correctByTerm[it.term] = it.correctCategory;
                      const cat = sortAssignments[text];
                      const ok = cat && cat === correctByTerm[text];
                      chipClass = ok ? "bg-green-50 border-green-300 text-green-800" : "bg-red-50 border-red-300 text-red-800";
                    }
                    return (
                      <div
                        ref={setNodeRef}
                        style={style}
                        className={`px-2 py-1 rounded border text-sm shadow-sm ${chipClass || "bg-white"} ${disabled ? "opacity-70" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-75 dragging" : ""}`}
                        {...(!disabled ? { ...attributes, ...listeners } : {})}
                      >
                        {text}
                      </div>
                    );
                  }

                  function DropZone({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
                    const { isOver, setNodeRef } = useDroppable({ id });
                    return (
                      <div className={`rounded-lg border ${isOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50"} p-3 min-h-[80px]`} ref={!disabled ? setNodeRef : undefined}>
                        <div className="text-xs font-medium text-slate-500 mb-2">{title}</div>
                        <div className="flex flex-wrap gap-2">{children}</div>
                      </div>
                    );
                  }

                  const tokensInCategory = (cat: string) => items.filter((t) => sortAssignments[t] === cat);
                  const unsorted = items.filter((t) => !sortAssignments[t]);

                  const onDragEnd = (e: DragEndEvent) => {
                    if (disabled) return;
                    const tokenId = String(e.active.id);
                    const overId = e.over?.id ? String(e.over.id) : undefined;
                    if (!overId) return;
                    if (overId === "unsorted") {
                      setSortAssignments((prev) => { const next = { ...prev }; delete next[tokenId]; return next; });
                    } else if (overId.startsWith("cat:")) {
                      const cat = overId.slice(4);
                      setSortAssignments((prev) => ({ ...prev, [tokenId]: cat }));
                    }
                  };

                  const checkNow = () => {
                    const correctByTerm: Record<string, string> = {};
                    for (const it of meta.items) correctByTerm[it.term] = it.correctCategory;
                    const allCorrect = items.every((t) => sortAssignments[t] && sortAssignments[t] === correctByTerm[t]);
                    setSortAllCorrect(allCorrect);
                    setSortChecked(true);
                    const respMs = Date.now() - sortStartRef.current;
                    setSortResponseMs(respMs);
                    // Snapshot user's attempt so we can restore it later if they view the correct sorting
                    sortAttemptRef.current = { ...sortAssignments };
                    // Stage pending answer; continue button below applies
                    pendingRef.current = {
                      cardId: card.id,
                      correct: allCorrect,
                      payload: { cardId: card.id, correct: allCorrect, assignments: sortAssignments },
                      telemetry: { responseMs: respMs, confidence: sortConfidence, guessed: sortGuessed, cardType: card.type },
                    };
                  };

                  return (
                    <div className="w-full">
                      <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question}</h2>
                      <DndContext sensors={sensors} onDragEnd={onDragEnd} collisionDetection={rectIntersection}>
                        <div className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
                          <DropZone id="unsorted" title="Unsorted">
                            {unsorted.map((t) => (
                              <DraggableChip key={t} id={t} text={t} />
                            ))}
                          </DropZone>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {categories.map((cat) => (
                              <DropZone id={`cat:${cat}`} key={cat} title={cat}>
                                {tokensInCategory(cat).map((t) => (
                                  <DraggableChip key={`${cat}:${t}`} id={t} text={t} />
                                ))}
                              </DropZone>
                            ))}
                          </div>
                        </div>
                      </DndContext>
                      {!sortChecked ? (
                        <div className="mt-4">
                          <div className="mb-3 flex items-center gap-3">
                            <label className="text-sm text-slate-600" htmlFor="sort-confidence">Confidence</label>
                            <select id="sort-confidence" value={sortConfidence ?? ""} onChange={(e) => setSortConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
                              <option value="">-</option>
                              <option value={0}>0</option>
                              <option value={1}>1</option>
                              <option value={2}>2</option>
                              <option value={3}>3</option>
                            </select>
                            <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={sortGuessed} onChange={(e) => setSortGuessed(e.target.checked)} />Guessed</label>
                          </div>
                          <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" onClick={checkNow} disabled={items.length === 0}>Check Answer</button>
                        </div>
                      ) : (
                        <>
                          <div className="mt-3">
                            {!sortShowCorrect ? (
                              <button
                                type="button"
                                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm"
                                onClick={() => {
                                  // Show the correct sorting by reassigning tokens to their correct categories
                                  const correctByTerm: Record<string, string> = {};
                                  for (const it of meta.items) correctByTerm[it.term] = it.correctCategory;
                                  const next: Record<string, string> = {};
                                  for (const term of items) next[term] = correctByTerm[term] ?? next[term];
                                  setSortAssignments(next);
                                  setSortShowCorrect(true);
                                }}
                              >
                                Show correct sorting
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm"
                                onClick={() => {
                                  // Restore user's attempt
                                  if (sortAttemptRef.current) setSortAssignments(sortAttemptRef.current);
                                  setSortShowCorrect(false);
                                }}
                              >
                                Show my attempt
                              </button>
                            )}
                          </div>
                          <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${sortAllCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                            <div className="font-semibold">{sortAllCorrect ? "Correct!" : "Not quite"}</div>
                            <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${sortAllCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={applyPendingAndAdvance}>Continue</button>
                          </div>
                        </>
                      )}
                      {card.explanation && sortChecked ? (
                        <div className="mt-3 text-sm text-slate-600">{card.explanation}</div>
                      ) : null}
                    </div>
                  );
                }
                if (card.type === "Compare/Contrast") {
                  const meta = card.meta as DeckCompareContrastMeta;
                  const itemA = meta.itemA;
                  const itemB = meta.itemB;
                  const rows = meta.points;

                  const normalize = (s: string) => s.trim().toLowerCase().replace(/[\p{P}\p{S}]/gu, "").replace(/\s+/g, " ");
                  const tokenize = (s: string) => normalize(s).split(" ").filter(Boolean);
                  const jaccard = (a: string, b: string) => {
                    const A = new Set(tokenize(a));
                    const B = new Set(tokenize(b));
                    if (A.size === 0 && B.size === 0) return 1;
                    let inter = 0; for (const t of A) if (B.has(t)) inter++;
                    const uni = new Set([...A, ...B]).size;
                    return uni > 0 ? inter / uni : 0;
                  };
                  const levenshteinRatio = (a: string, b: string) => {
                    const s = normalize(a);
                    const t = normalize(b);
                    const n = s.length; const m = t.length;
                    if (n === 0 && m === 0) return 1;
                    if (n === 0 || m === 0) return 0;
                    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
                    for (let i = 0; i <= n; i++) dp[i][0] = i;
                    for (let j = 0; j <= m; j++) dp[0][j] = j;
                    for (let i = 1; i <= n; i++) {
                      for (let j = 1; j <= m; j++) {
                        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
                        dp[i][j] = Math.min(
                          dp[i - 1][j] + 1,
                          dp[i][j - 1] + 1,
                          dp[i - 1][j - 1] + cost
                        );
                      }
                    }
                    const dist = dp[n][m];
                    const maxLen = Math.max(n, m);
                    return maxLen > 0 ? 1 - dist / maxLen : 1;
                  };
                  const similarity = (a: string, b: string) => Math.max(jaccard(a, b), levenshteinRatio(a, b));
                  const fuzzyEqual = (user: string, expected: string, threshold = 0.72) => similarity(user, expected) >= threshold;

                  const effectiveRowCorrect = (idx: number) => {
                    const pt = rows[idx];
                    const ov = ccOverride[idx];
                    if (ov === "right") return true;
                    if (ov === "wrong") return false;
                    const aOk = fuzzyEqual(ccA[idx] ?? "", pt.a ?? "");
                    const bOk = fuzzyEqual(ccB[idx] ?? "", pt.b ?? "");
                    return aOk && bOk;
                  };

                  const cellClass = (idx: number) => {
                    if (!ccChecked) return "border-slate-300";
                    return effectiveRowCorrect(idx) ? "border-green-500" : "border-red-500";
                  };

                  const checkNow = () => {
                    const all = rows.every((_pt, idx) => effectiveRowCorrect(idx));
                    setCcAllCorrect(all);
                    setCcChecked(true);
                    const respMs = Date.now() - ccStartRef.current;
                    setCcResponseMs(respMs);
                    pendingRef.current = {
                      cardId: card.id,
                      correct: all,
                      payload: { cardId: card.id, correct: all, a: ccA, b: ccB },
                      telemetry: { responseMs: respMs, confidence: ccConfidence, guessed: ccGuessed, cardType: card.type },
                    };
                  };

                  return (
                    <div className="w-full">
                      <h2 className="text-2xl font-semibold mb-4 text-slate-900">{card.question || `Compare ${itemA} and ${itemB}`}</h2>
                      <div className="overflow-x-auto">
                        <div className="inline-block min-w-full align-middle">
                          <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Feature</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{itemA}</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{itemB}</th>
                                  <th className="px-2 py-3 text-right text-sm font-medium text-slate-400">Self-mark</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {rows.map((pt, idx) => {
                                  const placeholderA = `How does ${pt.feature} relate to ${itemA}?`;
                                  const placeholderB = `How does ${pt.feature} relate to ${itemB}?`;
                                  return (
                                    <tr key={idx} className="align-top">
                                      <td className="px-4 py-3 text-sm text-slate-800 bg-slate-50 min-w-[160px]">{pt.feature}</td>
                                      <td className="px-4 py-3">
                                        <textarea
                                          className={`w-full rounded-lg border p-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${cellClass(idx)}`}
                                          rows={2}
                                          placeholder={placeholderA}
                                          value={ccA[idx] ?? ""}
                                          onChange={(e) => { if (!ccChecked) setCcA((prev) => ({ ...prev, [idx]: e.target.value })); }}
                                          readOnly={ccChecked}
                                        />
                                        {ccChecked && !effectiveRowCorrect(idx) && (rows[idx]?.a ?? "").trim().length > 0 ? (
                                          <div className="mt-2 text-xs text-green-700">
                                            <span className="font-semibold">Right answer:</span> {rows[idx]!.a}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="px-4 py-3">
                                        <textarea
                                          className={`w-full rounded-lg border p-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${cellClass(idx)}`}
                                          rows={2}
                                          placeholder={placeholderB}
                                          value={ccB[idx] ?? ""}
                                          onChange={(e) => { if (!ccChecked) setCcB((prev) => ({ ...prev, [idx]: e.target.value })); }}
                                          readOnly={ccChecked}
                                        />
                                        {ccChecked && !effectiveRowCorrect(idx) && (rows[idx]?.b ?? "").trim().length > 0 ? (
                                          <div className="mt-2 text-xs text-green-700">
                                            <span className="font-semibold">Right answer:</span> {rows[idx]!.b}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="px-2 py-3 whitespace-nowrap text-right">
                                        {ccChecked ? (
                                          <div className="inline-flex gap-2">
                                            <button type="button" className="px-2 py-1 rounded-md border border-green-500 text-green-600 hover:bg-green-50 text-xs" onClick={() => setCcOverride((prev) => ({ ...prev, [idx]: "right" }))}>I was right</button>
                                            <button type="button" className="px-2 py-1 rounded-md border border-red-500 text-red-600 hover:bg-red-50 text-xs" onClick={() => setCcOverride((prev) => ({ ...prev, [idx]: "wrong" }))}>I was wrong</button>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-slate-400">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      {!ccChecked ? (
                        <div className="mt-4">
                          <div className="mb-3 flex items-center gap-3">
                            <label className="text-sm text-slate-600" htmlFor="cc-confidence">Confidence</label>
                            <select id="cc-confidence" value={ccConfidence ?? ""} onChange={(e) => setCcConfidence(e.target.value === "" ? undefined : Number(e.target.value) as 0|1|2|3)} className="rounded border px-2 py-1 text-sm">
                              <option value="">-</option>
                              <option value={0}>0</option>
                              <option value={1}>1</option>
                              <option value={2}>2</option>
                              <option value={3}>3</option>
                            </select>
                            <label className="ml-2 text-sm"><input type="checkbox" className="mr-1" checked={ccGuessed} onChange={(e) => setCcGuessed(e.target.checked)} />Guessed</label>
                          </div>
                          <button type="button" className="px-4 py-2 rounded-xl bg-blue-600 text-white" onClick={checkNow}>Check Answers</button>
                        </div>
                      ) : (
                        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center justify-between ${ccAllCorrect ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800"}`}>
                          <div className="font-semibold">{ccAllCorrect ? "Correct!" : "Not quite"}</div>
                          <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${ccAllCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={applyPendingAndAdvance}>Continue</button>
                        </div>
                      )}
                      {card.explanation && ccChecked ? (
                        <div className="mt-3 text-sm text-slate-600">{card.explanation}</div>
                      ) : null}
                    </div>
                  );
                }
                if (card.type === "Two-Tier MCQ") {
                  const c = card as DeckTwoTierMCQ;
                  const t1 = c.meta.tier1;
                  const t2 = c.meta.tier2;
                  const tierBtn = (
                    tier: 1 | 2,
                    choice: "A" | "B" | "C" | "D",
                    label: string
                  ) => (
                    <button
                      type="button"
                      key={`${tier}-${choice}`}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                        (tier === 1 ? ttTier1 : ttTier2) === choice ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400"
                      }`}
                      onClick={() => {
                        if (ttChecked) return;
                        if (tier === 1) setTtTier1(choice); else setTtTier2(choice);
                      }}
                    >
                      <span className="font-semibold mr-2">{choice}.</span> {label}
                    </button>
                  );
                  const allChosen = Boolean(ttTier1 && ttTier2);
                  const allCorrect = Boolean(ttTier1 === t1.answer && ttTier2 === t2.answer);
                  return (
                    <div className="space-y-6">
                      <div>
                        <div className="text-[#2481f9] font-semibold mb-2">Tier 1: Content Question</div>
                        <div className="mb-2 text-slate-800">{card.question}</div>
                        <div className="grid grid-cols-2 gap-3">
                          {tierBtn(1, "A", t1.options.A)}
                          {tierBtn(1, "B", t1.options.B)}
                          {tierBtn(1, "C", t1.options.C)}
                          {tierBtn(1, "D", t1.options.D)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#2481f9] font-semibold mb-2">Tier 2: Reasoning Question</div>
                        <div className="mb-2 text-slate-800">{t2.question}</div>
                        <div className="grid grid-cols-2 gap-3">
                          {tierBtn(2, "A", t2.options.A)}
                          {tierBtn(2, "B", t2.options.B)}
                          {tierBtn(2, "C", t2.options.C)}
                          {tierBtn(2, "D", t2.options.D)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={!allChosen || ttChecked}
                          className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white disabled:opacity-60"
                          onClick={() => {
                            setTtChecked(true);
                            const respMs = Date.now() - ttStartRef.current;
                            setTtResponseMs(respMs);
                            const tier1Ok = ttTier1 === t1.answer;
                            const tier2Ok = ttTier2 === t2.answer;
                            const fractional = (Number(tier1Ok) + Number(tier2Ok)) / 2; // 0, 0.5, 1
                            pendingRef.current = {
                              cardId: card.id,
                              // Use fractional for quest scoring per request
                              correct: fractional,
                              payload: { tier1Ok, tier2Ok, fractional },
                              telemetry: { responseMs: respMs, cardType: card.type },
                            };
                          }}
                        >
                          Check Answer
                        </button>
                        {ttChecked ? (
                          <div className={`rounded-lg px-3 py-2 ${allCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{allCorrect ? "Correct!" : "Not quite"}</div>
                        ) : null}
                        {ttChecked ? (
                          <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={applyPendingAndAdvance}>Continue</button>
                        ) : null}
                      </div>
                    </div>
                  );
                }
                if (card.type === "CER") {
                  const c = card as DeckCER;
                  const meta = c.meta as DeckCERMeta;
                  if (meta.mode === "Multiple Choice") {
                    const partBlock = (
                      key: "claim" | "evidence" | "reasoning",
                      title: string,
                      opts: { text: string }[]
                    ) => (
                      <div className="space-y-2">
                        <div className="font-semibold text-slate-800">{title}</div>
                        <div className="grid grid-cols-2 gap-3">
                          {opts.map((o, idx) => (
                            <button
                              type="button"
                              key={idx}
                              className={`text-left px-3 py-2 rounded-lg border transition ${cerMCQSel[key] === idx ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400"}`}
                              onClick={() => { if (!cerMCQChecked) setCerMCQSel({ ...cerMCQSel, [key]: idx }); }}
                            >
                              <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span> {o.text}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                    const allChosen = cerMCQSel.claim !== null && cerMCQSel.evidence !== null && cerMCQSel.reasoning !== null;
                    const claimPart = meta.claim as { options: string[]; correct: number };
                    const evidencePart = meta.evidence as { options: string[]; correct: number };
                    const reasoningPart = meta.reasoning as { options: string[]; correct: number };
                    const allCorrect = Boolean(
                      cerMCQSel.claim === claimPart.correct &&
                      cerMCQSel.evidence === evidencePart.correct &&
                      cerMCQSel.reasoning === reasoningPart.correct
                    );
                    return (
                      <div className="space-y-6">
                        {/* Scenario/Prompt first */}
                        <div className="text-slate-900 whitespace-pre-wrap">{c.question}</div>
                        {/* Guidance below */}
                        {meta.guidanceQuestion ? <div className="text-sm text-slate-600 whitespace-pre-wrap">{meta.guidanceQuestion}</div> : null}
                        {partBlock("claim", "Claim", claimPart.options.map((t) => ({ text: t })))}
                        {partBlock("evidence", "Evidence", evidencePart.options.map((t) => ({ text: t })))}
                        {partBlock("reasoning", "Reasoning", reasoningPart.options.map((t) => ({ text: t })))}
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            disabled={!allChosen || cerMCQChecked}
                            className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white disabled:opacity-60"
                            onClick={() => {
                              setCerMCQChecked(true);
                              const respMs = Date.now() - cerMCQStartRef.current;
                              setCerMCQResponseMs(respMs);
                              const cOk = cerMCQSel.claim === claimPart.correct;
                              const eOk = cerMCQSel.evidence === evidencePart.correct;
                              const rOk = cerMCQSel.reasoning === reasoningPart.correct;
                              const fractional = (Number(cOk) + Number(eOk) + Number(rOk)) / 3;
                              pendingRef.current = {
                                cardId: card.id,
                                correct: fractional,
                                payload: { cOk, eOk, rOk, fractional },
                                telemetry: { responseMs: respMs, cardType: card.type },
                              };
                            }}
                          >
                            Check Answers
                          </button>
                          {cerMCQChecked ? (
                            <div className={`rounded-lg px-3 py-2 ${allCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{allCorrect ? "Correct!" : "Not quite"}</div>
                          ) : null}
                          {cerMCQChecked ? (
                            <button type="button" className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allCorrect ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`} onClick={applyPendingAndAdvance}>Continue</button>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                  // Free Text mode
                  const allJudged = cerFreeOverride.claim && cerFreeOverride.evidence && cerFreeOverride.reasoning;
                  const allOk = cerFreeOverride.claim === "right" && cerFreeOverride.evidence === "right" && cerFreeOverride.reasoning === "right";
                  return (
                    <div className="space-y-6">
                      {/* Scenario/Prompt first */}
                      <div className="text-slate-900 whitespace-pre-wrap">{c.question}</div>
                      {/* Guidance below */}
                      {meta.guidanceQuestion ? <div className="text-sm text-slate-600 whitespace-pre-wrap">{meta.guidanceQuestion}</div> : null}
                      {(["claim", "evidence", "reasoning"] as const).map((part) => (
                        <div key={part} className="mt-2">
                          <div className="font-semibold text-slate-800 capitalize">{part}</div>
                          <textarea
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                            rows={3}
                            value={cerFree[part]}
                            onChange={(e) => setCerFree({ ...cerFree, [part]: e.target.value })}
                            placeholder={`Type your ${part} here...`}
                            disabled={cerFreeChecked}
                          />
                          {cerFreeChecked && (
                            <>
                              {/* Suggested answer block shown after checking, above self-mark */}
                              {(() => {
                                const p = meta[part] as { sampleAnswer?: string } | { options: string[]; correct: number };
                                if ("sampleAnswer" in p && p.sampleAnswer && p.sampleAnswer.trim().length > 0) {
                                  return (
                                    <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                                      <div className="font-semibold text-slate-900 mb-1">Suggested {part}</div>
                                      <div className="whitespace-pre-wrap">{p.sampleAnswer}</div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            <div className="mt-2 inline-flex items-center gap-2">
                              <span className="text-sm text-slate-600">Was your {part} correct?</span>
                              <button type="button" className={`px-3 py-1.5 rounded border ${cerFreeOverride[part] === "right" ? "bg-green-600 text-white border-green-600" : "border-slate-300"}`} onClick={() => setCerFreeOverride({ ...cerFreeOverride, [part]: "right" })}>Yes</button>
                              <button type="button" className={`px-3 py-1.5 rounded border ${cerFreeOverride[part] === "wrong" ? "bg-red-600 text-white border-red-600" : "border-slate-300"}`} onClick={() => setCerFreeOverride({ ...cerFreeOverride, [part]: "wrong" })}>No</button>
                            </div>
                            </>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={cerFreeChecked}
                          className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white disabled:opacity-60"
                          onClick={() => {
                            setCerFreeChecked(true);
                            setCerFreeResponseMs(Date.now() - cerFreeStartRef.current);
                          }}
                        >
                          Check Answers
                        </button>
                        {cerFreeChecked ? (
                          <div className={`rounded-lg px-3 py-2 ${allOk ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{allOk ? "Looks good" : "Review your responses"}</div>
                        ) : null}
                        {cerFreeChecked ? (
                          <button
                            type="button"
                            disabled={!allJudged}
                            className={`px-4 py-2 rounded-lg font-medium shadow-sm ${allOk ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"} disabled:opacity-60`}
                            onClick={() => {
                              const cOk = cerFreeOverride.claim === "right";
                              const eOk = cerFreeOverride.evidence === "right";
                              const rOk = cerFreeOverride.reasoning === "right";
                              const fractional = (Number(cOk) + Number(eOk) + Number(rOk)) / 3;
                              pendingRef.current = { cardId: card.id, correct: fractional, payload: { cOk, eOk, rOk, fractional }, telemetry: { responseMs: cerFreeResponseMs, cardType: card.type } };
                              applyPendingAndAdvance();
                            }}
                          >
                            Continue
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                }
        if (card.type === "Sequencing") {
                  const seq = card.meta as unknown as { steps: string[] };
                  return (
                    <SequencingStudy
                      prompt={card.question}
                      steps={seq.steps}
                      onAnswer={({ allCorrect, responseMs, confidence, guessed }) => {
                        pendingRef.current = {
                          cardId: card.id,
                          correct: allCorrect,
                          payload: { cardId: card.id, correct: allCorrect },
                          telemetry: { responseMs, confidence, guessed, cardType: card.type },
                        };
                      }}
          onContinue={applyPendingAndAdvance}
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
          {/* TODO: replace tokens=0 with server-provided user tokens when available */}
          <AgentCard displayName={userDisplayName} level={1} tokens={Math.max(0, Math.round((xp?.commanderXpTotal ?? 0) * 0.25))} avatarUrl={userAvatarUrl ?? undefined} />
        </div>
      </div>
    </main>
  );
}
