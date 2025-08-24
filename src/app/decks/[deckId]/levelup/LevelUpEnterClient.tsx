"use client";
import { useEffect, useMemo, useState } from "react";
import { BLOOM_LEVELS, BLOOM_COLOR_HEX } from "@/types/card-catalog";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { useRouter } from "next/navigation";

type Counts = { total: number; perBloom: Partial<Record<DeckBloomLevel, number>> };

export default function LevelUpEnterClient({ deckId, counts, mastery }: { deckId: number; counts: Counts; mastery: Partial<Record<DeckBloomLevel, number>> }) {
  const router = useRouter();
  const [level, setLevel] = useState<DeckBloomLevel | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [weakOnly, setWeakOnly] = useState<boolean>(false);
  const [animatePct, setAnimatePct] = useState<number>(0);

  const sliderMax = useMemo(() => (level ? Math.max(0, counts.perBloom[level] ?? 0) : 0), [level, counts]);
  const currentPct = useMemo(() => (level ? Math.max(0, Math.min(100, Number(mastery[level] ?? 0))) : 0), [level, mastery]);

  useEffect(() => {
    if (!level) return setAnimatePct(0);
    setAnimatePct(0);
    const t = setTimeout(() => setAnimatePct(currentPct), 50);
    return () => clearTimeout(t);
  }, [level, currentPct]);

  function start() {
    if (!level) return;
    const params = new URLSearchParams();
    params.set("level", level);
    params.set("n", String(Math.min(amount, sliderMax)));
    if (weakOnly) params.set("weak", "1");
    router.push(`/decks/${deckId}/levelup?${params.toString()}`);
  }

  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm space-y-6">
      {/* Bloom level single-select pills */}
      <div>
        <label className="block text-sm font-medium text-slate-800 mb-2">Choose a Bloom level</label>
        <div className="flex flex-wrap gap-2">
          {(BLOOM_LEVELS as DeckBloomLevel[]).map((lvl) => {
            const on = level === lvl;
            const color = BLOOM_COLOR_HEX[lvl] || "#e2e8f0";
            const disabled = (counts.perBloom[lvl] ?? 0) === 0;
            return (
              <button
                key={lvl}
                type="button"
                disabled={disabled}
                onClick={() => setLevel(lvl)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition-colors ${on ? "text-white" : "text-slate-700"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{ backgroundColor: on ? color : "#fff", borderColor: on ? color : "#cbd5e1" }}
              >
                <span className="font-medium">{lvl}</span>
                <span className={`text-xs rounded px-1.5 py-0.5 ${on ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>{counts.perBloom[lvl] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-800">Number of cards</label>
          <div className="text-xs text-slate-600">0 – {sliderMax}</div>
        </div>
        <input
          type="range"
          min={0}
          max={sliderMax}
          disabled={!level}
          value={Math.min(amount, sliderMax)}
          onChange={(e) => setAmount(Math.min(Number(e.target.value || 0), sliderMax))}
          className="w-full"
        />
        <div className="mt-1 text-sm text-slate-700">Selected: <span className="font-semibold">{Math.min(amount, sliderMax)}</span></div>
      </div>

      {/* Weak cards only toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-800">Weak cards only</label>
        <button type="button" onClick={() => setWeakOnly((v) => !v)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${weakOnly ? "bg-slate-900" : "bg-slate-300"}`} aria-pressed={weakOnly}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${weakOnly ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* Mastery bar shows when a level is selected */}
      {level && (
        <div>
          <div className="mb-1 text-sm text-slate-700">Current mastery</div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden" aria-label="Bloom mastery">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${animatePct}%`, backgroundColor: BLOOM_COLOR_HEX[level] }}
            />
          </div>
          <div className="mt-1 text-xs text-slate-600">{Math.round(currentPct)}%</div>
        </div>
      )}

      <div className="pt-2 flex items-center justify-end">
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          onClick={start}
          disabled={!level || sliderMax === 0 || amount <= 0}
        >
          Start Level Up
        </button>
      </div>
    </div>
  );
}
