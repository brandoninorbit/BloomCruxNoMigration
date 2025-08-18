import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ClipboardList, Info, FileText, Shuffle, Target, Star, Timer, GraduationCap, Compass } from "lucide-react";
import { gradientForBloom, BLOOM_COLOR_HEX, BLOOM_LEVELS } from "@/types/card-catalog";
import type { DeckBloomLevel } from "@/types/deck-cards";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export default async function StudyPage({ params }: { params: Promise<{ deckId: string }> }) {
  const resolved = await params;
  const id = Number(resolved?.deckId);
  if (!Number.isFinite(id)) notFound();

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  let title = `Deck #${id}`;
  let bloomLevel: DeckBloomLevel | undefined;
  let mastery: number | undefined;
  if (user) {
    const { data: deck } = await supabase
      .from("decks")
      .select("id, title, mastery, bloomLevel")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (deck?.title) title = String(deck.title);
    if (typeof deck?.bloomLevel === "string") bloomLevel = deck.bloomLevel as DeckBloomLevel;
    if (typeof deck?.mastery === "number") mastery = deck.mastery as number;
  } else {
    title = `${title} (Logged Out)`;
  }

  // Bloom progress (reuse decks page color/gradient logic)
  const resolvedLevel: DeckBloomLevel = BLOOM_LEVELS.includes(bloomLevel as DeckBloomLevel)
    ? (bloomLevel as DeckBloomLevel)
    : ("Remember" as DeckBloomLevel);
  const percent = typeof mastery === "number" && mastery >= 0 ? mastery : 30;
  const grad = gradientForBloom(resolvedLevel);
  const color = BLOOM_COLOR_HEX[resolvedLevel] ?? "#4DA6FF";
  const pct = Math.max(0, Math.min(100, percent));

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

      {/* Bloom level progress (matches deck card styling) */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold" style={{ color }}>{resolvedLevel}</span>
          <span className="text-sm font-medium text-gray-500">{pct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, background: grad }} />
        </div>
      </div>

      {/* Info alert */}
      <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-800 p-4 rounded-lg mb-12 flex items-center">
  <Info className="h-5 w-5 mr-3" />
        <p>We recommend you finish the <span className="font-semibold">Quest</span> to tailor the rest of your tasks.</p>
      </div>

      {/* Missions Grid */}
      <div className="grid justify-center gap-8 [grid-template-columns:repeat(auto-fit,_minmax(18rem,_18rem))]">
        {[
          { key: "quest", icon: "article", title: "Operation: Quest", desc: "Standard-issue progression. Complete objectives in order.", cta: "Begin Mission" },
          { key: "random", icon: "shuffle", title: "Operation: Random Remix", desc: "A chaotic encounter. All intel is randomized.", cta: "Begin Mission" },
          { key: "weak", icon: "track_changes", title: "Operation: Target Practice", desc: "Hone your skills by focusing on known weak points.", cta: "Engage Targets" },
          { key: "starred", icon: "star_outline", title: "Operation: Starred Assets", desc: "Review high-value intel you\'ve personally marked.", cta: "Review Starred" },
          { key: "timed", icon: "timer", title: "Operation: Timed Drill", desc: "A high-pressure speed trial. Answer before the clock runs out.", cta: "Start Drill" },
          { key: "levelup", icon: "school", title: "Operation: Level Up", desc: "Advance your clearance one cognitive level at a time.", cta: "Enter Level-Up" },
          { key: "topics", icon: "explore", title: "Operation: Topic Trek", desc: "Infiltrate specific subjects by topic tag.", cta: "Explore Topics" },
        ].map((m) => {
          const Icon =
            m.icon === "article" ? FileText :
            m.icon === "shuffle" ? Shuffle :
            m.icon === "track_changes" ? Target :
            m.icon === "star_outline" ? Star :
            m.icon === "timer" ? Timer :
            m.icon === "school" ? GraduationCap :
            m.icon === "explore" ? Compass : FileText;
          return (
            <div key={m.key} className="bg-white rounded-xl shadow-lg p-6 aspect-square flex flex-col hover:transform hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center mb-4">
                <Icon className="text-blue-600 h-6 w-6 mr-3" />
                <h3 className="text-xl font-semibold text-gray-800">{m.title}</h3>
              </div>
              <p className="text-gray-500 mb-6 line-clamp-4">{m.desc}</p>
              <button className="mt-auto w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">{m.cta}</button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
