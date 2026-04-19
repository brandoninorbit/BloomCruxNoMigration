"use client";
import { useRouter } from "next/navigation";

type Counts = {
  total: number;
};

const MISSION_LENGTHS = {
  quick: { label: "Quick", min: 1, max: 10 },
  moderate: { label: "Moderate", min: 10, max: 15 },
  long: { label: "Long", min: 15, max: 30 },
} as const;

type MissionType = keyof typeof MISSION_LENGTHS;

export default function TargetEnterClient({ deckId }: { deckId: number; counts: Counts }) {
  const router = useRouter();

  function start(type: MissionType) {
    const params = new URLSearchParams();
    params.set("type", type);
    router.push(`/decks/${deckId}/target?${params.toString()}`);
  }

  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-800 mb-2">Mission Length</label>
          <p className="text-xs text-slate-600 mb-4">Choose how many weak cards to practice. We&apos;ll select the weakest cards based on your performance history.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(MISSION_LENGTHS) as MissionType[]).map((type) => {
              const config = MISSION_LENGTHS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => start(type)}
                  className="p-4 border rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="font-semibold text-slate-800">{config.label}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    {config.min} - {config.max} cards
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}