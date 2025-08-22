import { notFound } from "next/navigation";
import { ClipboardList, FileText, Timer, Target, Compass, Shuffle, Star, GraduationCap } from "lucide-react";
import { gradientForBloom, BLOOM_COLOR_HEX, BLOOM_LEVELS } from "@/types/card-catalog";
import type { DeckBloomLevel } from "@/types/deck-cards";
import QuestModalLauncher from "@/components/QuestModalLauncher";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseSession } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: Promise<{ deckId: string }> }) {
  const resolved = await params;
  const id = Number(resolved?.deckId);
  if (!Number.isFinite(id)) notFound();

  const title = `Deck #${id}`;
  // Fetch Bloom mastery from the mastery table instead of quest per_bloom
  type MasteryRow = { bloom_level: DeckBloomLevel; mastery_pct: number | null };
  const mastery: Partial<Record<DeckBloomLevel, number>> = {};
  const masteryRows: Array<{ bloom_level: DeckBloomLevel; mastery_pct: number | null }> = [];
  try {
    const session = await getSupabaseSession();
    if (session?.user?.id) {
      const sb = supabaseAdmin();
      const { data } = await sb
        .from("user_deck_bloom_mastery")
        .select("bloom_level, mastery_pct")
        .eq("deck_id", id)
        .eq("user_id", session.user.id);
      const norm = (s: string): DeckBloomLevel => {
        const t = String(s).trim().toLowerCase();
        if (t.startsWith('remember')) return 'Remember' as DeckBloomLevel;
        if (t.startsWith('understand')) return 'Understand' as DeckBloomLevel;
        if (t.startsWith('apply')) return 'Apply' as DeckBloomLevel;
        if (t.startsWith('analy')) return 'Analyze' as DeckBloomLevel;
        if (t.startsWith('eval')) return 'Evaluate' as DeckBloomLevel;
        if (t.startsWith('create')) return 'Create' as DeckBloomLevel;
        return 'Remember' as DeckBloomLevel;
      };
      for (const row of (data ?? []) as MasteryRow[]) {
        masteryRows.push({ bloom_level: row.bloom_level, mastery_pct: row.mastery_pct });
        const raw = typeof row.mastery_pct === "number" ? row.mastery_pct : 0;
        const pct = raw > 0 && raw <= 1 ? raw * 100 : raw;
        mastery[norm(row.bloom_level)] = pct;
      }
    }
  } catch {}

  // Determine prior (most recently accomplished) and goal (current unlocked) Bloom levels
  const threshold = 80; // show next level when current >= 80%
  const levels: DeckBloomLevel[] = BLOOM_LEVELS as DeckBloomLevel[];
  const capIndex = Math.max(0, levels.indexOf("Evaluate" as DeckBloomLevel));
  let displayIndex = 0;
  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i]!;
    const mp = Number(mastery[lvl] ?? 0);
    if (mp < threshold) { displayIndex = i; break; }
    if (i >= capIndex) { displayIndex = capIndex; break; }
    displayIndex = Math.min(i + 1, capIndex);
    if (displayIndex === capIndex) break;
  }
  const goalLevel: DeckBloomLevel = levels[displayIndex] ?? ("Remember" as DeckBloomLevel);
  const goalPercent = Math.max(0, Math.min(100, Math.round(Number(mastery[goalLevel] ?? 0))));
  const priorIndex = Math.max(0, displayIndex - 1);
  const priorLevel: DeckBloomLevel | null = displayIndex > 0 ? levels[priorIndex] : null;
  const priorPercent = priorLevel ? Math.max(0, Math.min(100, Math.round(Number(mastery[priorLevel] ?? 0)))) : 0;
  const goalGrad = gradientForBloom(goalLevel);
  const priorGrad = priorLevel ? gradientForBloom(priorLevel) : undefined;
  const goalColor = BLOOM_COLOR_HEX[goalLevel] ?? "#4DA6FF";
  const priorColor = priorLevel ? BLOOM_COLOR_HEX[priorLevel] ?? "#9CA3AF" : "#9CA3AF";

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Agent Briefing */}
      <div className="text-center mb-12">
        <div className="inline-block bg-blue-100 p-4 rounded-full mb-4">
          <ClipboardList className="text-blue-600 h-10 w-10" />
        </div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Agent Briefing</h1>
  <p className="text-gray-500">Agent, your dossier for <span className="font-semibold text-gray-700">{title}</span> is ready. Select your assignment.</p>
      </div>

      {/* Mastery pills (top two mastered; lower level on top, highest below). No pills if nothing mastered. */}
  <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        {(() => {
          const levels: DeckBloomLevel[] = BLOOM_LEVELS as DeckBloomLevel[];
          const mastered = levels
            .map((lvl) => ({ lvl, pct: Number(mastery[lvl] ?? 0) }))
            .filter((x) => x.pct >= threshold)
            .sort((a, b) => levels.indexOf(a.lvl) - levels.indexOf(b.lvl));
          const topTwo = mastered.slice(-2);
          if (topTwo.length === 0) return null;
          return (
            <div className="flex flex-col gap-2 items-center">
              {topTwo.map((m, idx) => (
                <span
                  key={`${m.lvl}-${idx}`}
                  className="inline-flex items-center justify-center text-center rounded-full px-3 py-1 text-sm font-semibold text-white shadow-sm overflow-hidden whitespace-nowrap"
                  style={{ backgroundColor: BLOOM_COLOR_HEX[m.lvl] ?? '#4DA6FF', width: 'min(22ch, 100%)', boxSizing: 'border-box' }}
                >
                  {`MASTERED: ${m.lvl}`}
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Study mode tiles: Quest + other modes (Timed Drill, Topic Trek, Target Practice, Random, Starred, Level Up) */}
      <div className="grid justify-center gap-8 [grid-template-columns:repeat(auto-fit,_minmax(18rem,_18rem))]">
        {/* Quest (modal) */}
        <div className="bg-white rounded-xl shadow-lg p-6 aspect-square flex flex-col hover:transform hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center mb-4">
            <FileText className="text-blue-600 h-6 w-6 mr-3" />
            <h3 className="text-xl font-semibold text-gray-800">Operation: Quest</h3>
          </div>
          <p className="text-gray-500 mb-6 line-clamp-4">Enter, resume, or replay unlocked missions. Locked missions are shown and greyed out.</p>
          <QuestModalLauncher deckId={id} />
        </div>

        {/* Timed Drill */}
        <div className="bg-white rounded-xl shadow-lg p-6 aspect-square flex flex-col hover:transform hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center mb-4">
            <Timer className="text-blue-600 h-6 w-6 mr-3" />
            <h3 className="text-xl font-semibold text-gray-800">Timed Drill</h3>
          </div>
          <p className="text-gray-500 mb-6 line-clamp-4">A high‑pressure test of speed and accuracy to boost recall.</p>
          <a href={`/decks/${id}/quest?mode=timed`} className="mt-auto w-full text-center bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Start Timed Drill</a>
        </div>

        {/* Topic Trek */}
        <div className="bg-white rounded-xl shadow-lg p-6 aspect-square flex flex-col hover:transform hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center mb-4">
            <Compass className="text-blue-600 h-6 w-6 mr-3" />
            <h3 className="text-xl font-semibold text-gray-800">Topic Trek</h3>
          </div>
          <p className="text-gray-500 mb-6 line-clamp-4">Explore specific topics and reinforce targeted concepts.</p>
          <a href={`/decks/${id}/quest?mode=topics`} className="mt-auto w-full text-center bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Start Topic Trek</a>
        </div>

        {/* Target Practice / Boost */}
        <div className="bg-white rounded-xl shadow-lg p-6 aspect-square flex flex-col hover:transform hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center mb-4">
            <Target className="text-blue-600 h-6 w-6 mr-3" />
            <h3 className="text-xl font-semibold text-gray-800">Target Practice</h3>
          </div>
          <p className="text-gray-500 mb-6 line-clamp-4">Focus on weak cards and shore up trouble spots with concentrated practice.</p>
          <a href={`/decks/${id}/quest?mode=boost`} className="mt-auto w-full text-center bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Start Target Practice</a>
        </div>

        {/* Random Practice */}
        <div className="bg-white rounded-xl shadow-lg p-6 aspect-square flex flex-col hover:transform hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center mb-4">
            <Shuffle className="text-blue-600 h-6 w-6 mr-3" />
            <h3 className="text-xl font-semibold text-gray-800">Random Practice</h3>
          </div>
          <p className="text-gray-500 mb-6 line-clamp-4">A randomized selection to keep your recall sharp across the deck.</p>
          <a href={`/decks/${id}/quest?mode=random`} className="mt-auto w-full text-center bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Start Random</a>
        </div>

        {/* Starred */}
        <div className="bg-white rounded-xl shadow-lg p-6 aspect-square flex flex-col hover:transform hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center mb-4">
            <Star className="text-blue-600 h-6 w-6 mr-3" />
            <h3 className="text-xl font-semibold text-gray-800">Starred</h3>
          </div>
          <p className="text-gray-500 mb-6 line-clamp-4">Focus on cards you&apos;ve starred for targeted review.</p>
          <a href={`/decks/${id}/quest?mode=starred`} className="mt-auto w-full text-center bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Study Starred</a>
        </div>

        {/* Level Up */}
        <div className="bg-white rounded-xl shadow-lg p-6 aspect-square flex flex-col hover:transform hover:-translate-y-1 transition-transform duration-300">
          <div className="flex items-center mb-4">
            <GraduationCap className="text-blue-600 h-6 w-6 mr-3" />
            <h3 className="text-xl font-semibold text-gray-800">Level Up</h3>
          </div>
          <p className="text-gray-500 mb-6 line-clamp-4">Practice optimally to level up faster and earn tokens.</p>
          <a href={`/decks/${id}/quest?mode=levelup`} className="mt-auto w-full text-center bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Start Level Up</a>
        </div>
      </div>

      {/* Debug panel: raw mastery rows and computed map used for the progress bar */}
      <details className="mt-8 border rounded p-3 bg-slate-50">
        <summary className="cursor-pointer text-sm text-slate-700">Debug: Bloom mastery rows + computed map</summary>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-600 mb-1">Rows from user_deck_bloom_mastery</div>
            <pre className="text-xs whitespace-pre-wrap bg-white border rounded p-2">{JSON.stringify(masteryRows, null, 2)}</pre>
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Computed mastery map</div>
            <pre className="text-xs whitespace-pre-wrap bg-white border rounded p-2">{JSON.stringify(mastery, null, 2)}</pre>
          </div>
        </div>
      </details>
    </main>
  );
}
