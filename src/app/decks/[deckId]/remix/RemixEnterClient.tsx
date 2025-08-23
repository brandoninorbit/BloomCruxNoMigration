"use client";
import { useMemo, useState } from "react";
import { BLOOM_LEVELS, BLOOM_COLOR_HEX } from "@/types/card-catalog";
import type { DeckBloomLevel, DeckCardType } from "@/types/deck-cards";
import { useRouter } from "next/navigation";

type Counts = {
  total: number;
  perBloom: Partial<Record<DeckBloomLevel, number>>;
  perType: Partial<Record<DeckCardType, number>>;
};

export default function RemixEnterClient({ deckId, counts }: { deckId: number; counts: Counts }) {
  const router = useRouter();
  const max = Math.max(0, Number(counts.total || 0));
  const [amount, setAmount] = useState<number>(Math.min(20, max));
  const [levelsOpen, setLevelsOpen] = useState<boolean>(false);
  const [levels, setLevels] = useState<Partial<Record<DeckBloomLevel, boolean>>>(() => {
    const m: Partial<Record<DeckBloomLevel, boolean>> = {};
    (BLOOM_LEVELS as DeckBloomLevel[]).forEach((lvl) => { m[lvl] = (counts.perBloom[lvl] ?? 0) > 0; });
    return m;
  });
  const [cardTypeMode, setCardTypeMode] = useState<"mcq" | "mix" | "excludeheavy">("mix");

  const selectedBloom = useMemo(() => (BLOOM_LEVELS as DeckBloomLevel[]).filter((lvl) => !!levels[lvl]), [levels]);
  const selectedCount = useMemo(() => selectedBloom.reduce((sum, lvl) => sum + (counts.perBloom[lvl] ?? 0), 0), [selectedBloom, counts]);

  const sliderMax = Math.max(0, selectedCount || max);
  const sliderMin = 0;

  function toggleLevel(lvl: DeckBloomLevel) {
    setLevels((prev) => ({ ...prev, [lvl]: !prev[lvl] }));
  }

  function start() {
    const params = new URLSearchParams();
    params.set("n", String(amount));
    if (selectedBloom.length) params.set("levels", selectedBloom.join(","));
    params.set("types", cardTypeMode);
    router.push(`/decks/${deckId}/remix?${params.toString()}`);
  }

  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm">
      <div className="space-y-5">
        {/* Amount slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-800">Number of cards</label>
            <div className="text-xs text-slate-600">0 – {sliderMax}</div>
          </div>
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            value={Math.min(amount, sliderMax)}
            onChange={(e) => setAmount(Math.min(Number(e.target.value || 0), sliderMax))}
            className="w-full"
          />
          <div className="mt-1 text-sm text-slate-700">Selected: <span className="font-semibold">{Math.min(amount, sliderMax)}</span></div>
        </div>

        {/* Bloom levels */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-800">Bloom levels</label>
            <button type="button" className="text-sm text-blue-700 hover:underline" onClick={() => setLevelsOpen((v) => !v)}>
              {levelsOpen ? "Hide" : "Show"} options
            </button>
          </div>
          {levelsOpen && (
            <div className="flex flex-wrap gap-2">
              {(BLOOM_LEVELS as DeckBloomLevel[]).map((lvl) => {
                const on = !!levels[lvl];
                const color = BLOOM_COLOR_HEX[lvl] || "#e2e8f0";
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => toggleLevel(lvl)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition-colors ${on ? "text-white" : "text-slate-700"}`}
                    style={{ backgroundColor: on ? color : "#fff", borderColor: on ? color : "#cbd5e1" }}
                  >
                    <span className="font-medium">{lvl}</span>
                    <span className={`text-xs rounded px-1.5 py-0.5 ${on ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>{counts.perBloom[lvl] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card Types preference */}
        <div>
          <label className="block text-sm font-medium text-slate-800 mb-2">Card types</label>
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setCardTypeMode("mcq")}
              className={`px-3 py-1.5 text-sm ${cardTypeMode === "mcq" ? "bg-slate-900 text-white" : "bg-white text-slate-800"}`}
            >
              MCQ only
            </button>
            <button
              type="button"
              onClick={() => setCardTypeMode("mix")}
              className={`px-3 py-1.5 text-sm border-l border-slate-300 ${cardTypeMode === "mix" ? "bg-slate-900 text-white" : "bg-white text-slate-800"}`}
            >
              Mix of all
            </button>
            <button
              type="button"
              onClick={() => setCardTypeMode("excludeheavy")}
              className={`px-3 py-1.5 text-sm border-l border-slate-300 ${cardTypeMode === "excludeheavy" ? "bg-slate-900 text-white" : "bg-white text-slate-800"}`}
            >
              Exclude CER & Two‑Tier
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-600">Tip: choose Exclude for faster play sessions.</p>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <div className="text-sm text-slate-600">Cards available in selection: <span className="font-semibold">{sliderMax}</span></div>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            onClick={start}
            disabled={sliderMax === 0 || amount <= 0}
          >
            Start Random
          </button>
        </div>
      </div>
    </div>
  );
}
