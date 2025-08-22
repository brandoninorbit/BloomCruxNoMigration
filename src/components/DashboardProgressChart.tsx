"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
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
import { format } from "date-fns";
import { deckColor } from "@/lib/analytics";

export function computeSMA(values: number[], k = 5): number[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  const out: number[] = new Array(values.length).fill(0);
  let windowSum = 0;
  for (let i = 0; i < values.length; i++) {
    windowSum += values[i];
    if (i - k >= 0) {
      windowSum -= values[i - k];
      out[i] = windowSum / k;
    } else {
      out[i] = windowSum / (i + 1);
    }
  }
  return out;
}

type AttemptRow = {
  deck_id: number;
  deck_title?: string | null;
  score_pct?: number | null;
  cards_seen?: number | null;
  cards_correct?: number | null;
  ended_at?: string | null;
};

export default function DashboardProgressChart({ showSMAOnly = true }: { showSMAOnly?: boolean }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  // order of deck ids by recent activity (kept local only)
  const [deckMap, setDeckMap] = useState<Record<number, { title: string; count: number; lastAt: number }>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [unifiedData, setUnifiedData] = useState<Array<Record<string, number | undefined>>>([]);

  const storageKey = useMemo(() => (user ? `dashboard_progress_selected_${user.id}` : null), [user]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const sb = getSupabaseClient();
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: attempts } = await sb
          .from("user_deck_mission_attempts")
          .select("deck_id, score_pct, cards_seen, cards_correct, ended_at")
          .gte("ended_at", cutoff)
          .order("ended_at", { ascending: true });

        if (!mounted) return;
        const rows = (attempts ?? []) as AttemptRow[];

        const perDeck: Record<number, AttemptRow[]> = {};
        for (const r of rows) {
          if (!r || r.deck_id == null || !r.ended_at) continue;
          const id = Number(r.deck_id);
          if (!perDeck[id]) perDeck[id] = [];
          perDeck[id].push(r);
        }

        const map: Record<number, { title: string; count: number; lastAt: number }> = {};
        for (const [idStr, arr] of Object.entries(perDeck)) {
          const id = Number(idStr);
          const lastAt = Math.max(...arr.map((a) => new Date(a.ended_at ?? "").getTime()));
          map[id] = { title: `Deck ${id}`, count: arr.length, lastAt };
        }

        const deckIds = Object.keys(map).map((s) => Number(s));
        if (deckIds.length > 0) {
          const { data: decks } = await sb.from("decks").select("id, title").in("id", deckIds);
          for (const d of (decks ?? []) as Array<{ id: number; title?: string | null }>) {
            if (map[d.id]) map[d.id].title = String(d.title ?? `Deck ${d.id}`);
          }
        }

        const ordered = Object.entries(map)
          .map(([k, v]) => ({ id: Number(k), lastAt: v.lastAt }))
          .sort((a, b) => b.lastAt - a.lastAt)
          .map((x) => x.id);

        const saved = storageKey ? localStorage.getItem(storageKey) : null;
        const parsed: number[] | null = saved ? JSON.parse(saved) : null;
        const initialSelected = (parsed && parsed.length > 0) ? parsed.filter((id) => ordered.includes(id)) : ordered.slice(0, 2);

        const allTimestampsSet = new Set<number>();
        const deckSeries: Record<number, { rows: { t: number; acc: number; sma?: number }[] }> = {};
        for (const id of Object.keys(perDeck).map((s) => Number(s))) {
          const arr = perDeck[id].slice().sort((a, b) => new Date(a.ended_at!).getTime() - new Date(b.ended_at!).getTime());
          const series = arr.map((a) => {
            const acc = typeof a.score_pct === "number" ? Number(a.score_pct) : (Number(a.cards_seen ?? 0) > 0 ? (Number(a.cards_correct ?? 0) / Number(a.cards_seen ?? 1)) * 100 : 0);
            const t = new Date(a.ended_at!).getTime();
            allTimestampsSet.add(t);
            return { t, acc: Math.max(0, Math.min(100, acc)) };
          });
          const smaArr = computeSMA(series.map((s) => s.acc), 5);
          deckSeries[id] = { rows: series.map((s, i) => ({ t: s.t, acc: s.acc, sma: Number((smaArr[i] ?? 0).toFixed(3)) })) };
        }

        const allTimestamps = Array.from(allTimestampsSet).sort((a, b) => a - b);
        const unified: Array<Record<string, number | undefined>> = allTimestamps.map((t) => {
          const row: Record<string, number | undefined> = { t } as Record<string, number | undefined>;
          for (const id of Object.keys(deckSeries).map((s) => Number(s))) {
            const point = deckSeries[id].rows.find((r) => r.t === t);
            row[`${id}_acc`] = point ? Number(point.acc.toFixed(1)) : undefined;
            row[`${id}_sma`] = point ? Number(point.sma!.toFixed(1)) : undefined;
          }
          return row;
        });

  setDeckMap(map);
        setSelected(initialSelected);
        setUnifiedData(unified);
      } catch (err) {
          console.debug("DashboardProgressChart fetch error", err);
        } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(selected));
    } catch {
      // ignore
    }
  }, [selected, storageKey]);

  if (!user) return null;

  const deckList = Object.entries(deckMap).map(([idStr, info]) => ({ id: Number(idStr), ...info })).sort((a, b) => b.lastAt - a.lastAt);

  return (
    <div className="flex h-full gap-4">
      <aside className="w-56 overflow-auto pr-2">
        <div className="text-sm font-semibold mb-2">Decks (last 30 days)</div>
        <div className="space-y-2">
          {deckList.length === 0 && <div className="text-xs text-gray-500">No attempts in the last 30 days.</div>}
          {deckList.map((d) => (
            <label key={d.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-md cursor-pointer">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selected.includes(d.id)} onChange={() => {
                  setSelected((prev) => prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]);
                }} />
                <div className="text-sm">
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-gray-500">{d.count} attempts</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </aside>

      <div className="flex-1">
        {/* Legend */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {deckList.map((d) => {
            const color = deckColor(String(d.id));
            const isOn = selected.includes(d.id);
            return (
              <button
                key={`pill-${d.id}`}
                type="button"
                aria-label={`Toggle deck ${d.title} in chart`}
                title={`Toggle deck ${d.title} in chart`}
                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${isOn ? 'bg-white' : 'bg-gray-50 opacity-60'} hover:opacity-100`}
                onClick={() => setSelected((prev) => prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id])}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-medium">{d.title}</span>
                <span className="text-gray-500">{d.count} attempts</span>
              </button>
            );
          })}
        </div>
        <div className="w-full h-64">
          {loading ? <div className="text-sm text-gray-500">Loading...</div> : (
            <ResponsiveContainer width="100%" height="100%">
              <RLineChart data={unifiedData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => format(new Date(v), "MMM d")} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <RTooltip
                  labelFormatter={(label: number) => format(new Date(label), "PPpp")}
                  formatter={(value: number | string, name: string) => {
                    const num = typeof value === 'number' ? value : Number(value);
                    if (Number.isFinite(num)) return [`${num.toFixed(1)}%`, name];
                    return [String(value), name];
                  }}
                />
                {selected.map((deckId) => {
                  const info = deckMap[deckId];
                  const colorAcc = deckColor(String(deckId));
                  const colorSma = deckColor(String(deckId));
                  const accKey = `${deckId}_acc`;
                  const smaKey = `${deckId}_sma`;
                  return (
                    <React.Fragment key={deckId}>
                      {!showSMAOnly && <Line type="monotone" dataKey={accKey} stroke={colorAcc} strokeWidth={2} dot={false} name={`${info.title} Accuracy`} />}
                      <Line type="monotone" dataKey={smaKey} stroke={colorSma} strokeWidth={2} dot={false} name={`${info.title} SMA(5)`} />
                    </React.Fragment>
                  );
                })}
              </RLineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
