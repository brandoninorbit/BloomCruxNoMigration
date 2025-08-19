import type { DeckBloomLevel } from "@/types/deck-cards";
import type { MissionState, SRSPerformance, UserBloomProgress, XpLedger } from "./types";

// Fetch helpers against our Next.js API routes; these run client-side.
const api = (deckId: number, path: string) => `/api/quest/${deckId}${path}`;

export async function fetchProgress(deckId: number): Promise<{ progress: UserBloomProgress | null; xp: XpLedger | null }> {
  const res = await fetch(api(deckId, "/progress"), { cache: "no-store" });
  if (!res.ok) return { progress: null, xp: null };
  const data = await res.json();
  if (!data?.found) return { progress: null, xp: null };
  return { progress: data.per_bloom ?? null, xp: data.xp ?? null };
}

export async function saveProgressRepo(deckId: number, progress: UserBloomProgress, xp: XpLedger | undefined) {
  await fetch(api(deckId, "/progress"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ per_bloom: progress, xp: xp ?? undefined }),
  });
}

export async function fetchMission(deckId: number, level: DeckBloomLevel, missionIndex: number): Promise<MissionState | null> {
  const u = new URL(api(deckId, "/mission"), window.location.origin);
  u.searchParams.set("bloomLevel", level);
  u.searchParams.set("missionIndex", String(missionIndex));
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const data: { found?: boolean; mission?: { sequence_seed: string; card_order: unknown[]; answered?: { cardId: number; correct: boolean }[]; started_at: string; resumed_at?: string | null } } = await res.json();
  if (!data?.found || !data.mission) return null;
  const m = data.mission;
  return {
    deckId,
    bloomLevel: level,
    missionIndex,
    sequenceSeed: m.sequence_seed,
    cardOrder: Array.isArray(m.card_order) ? m.card_order.map((n) => Number(n)) : [],
    answered: Array.isArray(m.answered) ? m.answered : [],
    correctCount: (Array.isArray(m.answered) ? m.answered : []).filter((a) => a.correct).length,
    startedAt: m.started_at,
    resumedAt: m.resumed_at ?? undefined,
  };
}

export async function upsertMission(deckId: number, state: MissionState & { completedAt?: string | null }) {
  await fetch(api(deckId, "/mission"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bloom_level: state.bloomLevel,
      mission_index: state.missionIndex,
      sequence_seed: state.sequenceSeed,
      card_order: state.cardOrder,
      answered: state.answered,
      started_at: state.startedAt,
      resumed_at: state.resumedAt ?? null,
      completed_at: state.completedAt ?? null,
    }),
  });
}

export async function fetchSrs(deckId: number): Promise<SRSPerformance> {
  const res = await fetch(api(deckId, "/srs"), { cache: "no-store" });
  if (!res.ok) return {};
  const data: { srs?: Array<{ cardId: number; attempts: number; correct: number; lastSeenAt?: string | null }> } = await res.json();
  const srs: SRSPerformance = {};
  for (const row of data.srs ?? []) {
    srs[row.cardId] = { attempts: row.attempts ?? 0, correct: row.correct ?? 0, lastSeenAt: row.lastSeenAt ?? undefined };
  }
  return srs;
}

export async function upsertSrs(deckId: number, srs: SRSPerformance) {
  const updates = Object.entries(srs).map(([cardId, perf]) => ({ cardId: Number(cardId), ...perf }));
  await fetch(api(deckId, "/srs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
}

export async function logXpEvent(deckId: number, level: DeckBloomLevel, eventType: string, payload?: unknown) {
  await fetch(api(deckId, "/xp-events"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bloom_level: level, event_type: eventType, payload: payload ?? {} }),
  });
}
