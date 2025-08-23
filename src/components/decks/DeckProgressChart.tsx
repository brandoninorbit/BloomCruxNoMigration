"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

export default function DeckProgressChart({ deckId, height = 150 }: { deckId: number; height?: number }) {
  const [data, setData] = useState<Array<{ idx: number; acc: number; ended_at: string }>>([]);

  const fetchData = useCallback(async () => {
    try {
      const sb = getSupabaseClient();
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await sb
        .from("user_deck_mission_attempts")
        .select("score_pct, cards_seen, cards_correct, ended_at")
        .eq("deck_id", deckId)
        .gte("ended_at", cutoff)
        .order("ended_at", { ascending: true });
      const arr: Array<{ idx: number; acc: number; ended_at: string }> = [];
      type Row = { score_pct?: number | null; cards_seen?: number | null; cards_correct?: number | null; ended_at?: string | null };
      const rowsTyped = (rows ?? []) as Row[];
      for (let i = 0; i < rowsTyped.length; i++) {
        const r = rowsTyped[i];
        const acc = Number(r?.score_pct ?? 0);
        arr.push({ idx: i + 1, acc: Math.max(0, Math.min(100, acc)), ended_at: r?.ended_at ?? new Date().toISOString() });
      }
      setData(arr);
    } catch (err) {
      console.debug('DeckProgressChart fetch error', err);
    }
  }, [deckId]);

  useEffect(() => {
    let mounted = true;
    fetchData();
    // Subscribe to realtime inserts for this deck
    const sb = getSupabaseClient();
    const channel = sb
      .channel(`deck_attempts_${deckId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_deck_mission_attempts', filter: `deck_id=eq.${deckId}` }, () => {
        if (!mounted) return;
        // Fetch fresh data when a new attempt arrives
        fetchData();
      })
      .subscribe();
    // Fallback: refresh when page/tab becomes visible
    const onVis = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      mounted = false;
      try { document.removeEventListener('visibilitychange', onVis); } catch {}
      try { sb.removeChannel(channel); } catch {}
    };
  }, [deckId, fetchData]);

  const sma = useMemo(() => computeSMA(data.map((d) => d.acc), 5), [data]);

  const chartData = useMemo(() => data.map((d, i) => ({ name: String(d.idx), Accuracy: Number(d.acc.toFixed(1)), SMA: Number((sma[i] ?? 0).toFixed(1)) })), [data, sma]);

  const h = Math.max(150, Number(height) || 150);
  return (
    <div style={{ width: "100%", minHeight: h, height: h }} className="mt-3" aria-label="Deck progress over time">
      {data.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 bg-gray-50 rounded-md border border-gray-200 px-3 py-2 text-center">
          Complete a mission in this deck to unlock your 30-day trend.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <RLineChart data={chartData} margin={{ top: 4, right: 6, left: 6, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <RTooltip
              formatter={(value: number) => `${value.toFixed(1)}%`}
              labelFormatter={(label) => `Attempt ${label}`}
              wrapperStyle={{ pointerEvents: "none" }}
            />
            <Line type="monotone" dataKey="Accuracy" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="SMA" stroke="#10b981" strokeWidth={2} dot={false} />
          </RLineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
