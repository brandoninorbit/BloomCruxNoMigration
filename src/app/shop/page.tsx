"use client";
import React from "react";
import ShopCard, { ShopCardProps } from "../../components/shop/ShopCard";
import { DeckCoverDeepSpace, DeckCoverNightMission } from "@/components/DeckCovers";
import { fetchWithAuth } from "@/lib/supabase/fetchWithAuth";
import { CATEGORY_UNLOCK_LEVELS } from "@/lib/unlocks";

type Category = {
  title: string;
  unlockLevel: number;
  items: ShopCardProps[];
};

const cosmeticCategories: Category[] = [
  {
    title: "Deck Covers",
    unlockLevel: CATEGORY_UNLOCK_LEVELS.DeckCovers,
    items: [
      {
        id: "Sunrise",
        title: "Sunrise Cover",
        description: "Brighten your deck with a warm sunrise gradient.",
        price: 80,
        icon: (
          <div className="h-24 w-full rounded-lg bg-gradient-to-br from-orange-300 via-pink-300 to-yellow-200" />
        ),
      },
      {
        id: "DeepSpace",
        title: "Deep Space Cover",
        description: "A tranquil starfield with subtle parallax and twinkle.",
        price: 120,
        unlockLevel: 3,
        icon: (
          <div className="h-24 w-full rounded-lg overflow-hidden">
            <DeckCoverDeepSpace fill className="h-24 w-full rounded-lg" />
          </div>
        ),
      },
      {
        id: "NightMission",
        title: "Night Mission Cover",
        description: "Moody night skyline with gentle parallax and blinking windows.",
        price: 110,
        unlockLevel: 5,
        icon: (
          <div className="h-24 w-full rounded-lg overflow-hidden">
            <DeckCoverNightMission fill className="h-24 w-full rounded-lg" />
          </div>
        ),
      },
    ],
  },
  {
    title: "Avatar Frames",
  unlockLevel: CATEGORY_UNLOCK_LEVELS.AvatarFrames,
    items: [],
  },
  {
    title: "Page Backgrounds",
  unlockLevel: CATEGORY_UNLOCK_LEVELS.PageBackgrounds,
    items: [],
  },
];

export default function ShopPage() {
  const [commanderLevel, setCommanderLevel] = React.useState<number>(0);
  const [purchased, setPurchased] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  // Try to load real commander level if logged in; otherwise stays 0
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth("/api/economy/wallet", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const lvl = Number(data?.commander_level ?? 0);
        if (!cancelled) setCommanderLevel(Number.isFinite(lvl) ? lvl : 0);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Load purchased states for known items (Sunrise + Deep Space + Night Mission)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
  const ids = ["Sunrise", "DeepSpace", "NightMission"] as const;
        for (const id of ids) {
          const res = await fetchWithAuth(`/api/covers/purchased?coverId=${encodeURIComponent(id)}`, { cache: 'no-store' });
          if (!res.ok) continue;
          const j = await res.json();
          if (!cancelled) setPurchased((p) => ({ ...p, [id]: !!j?.purchased }));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePurchase = async (id: string) => {
    setLoading((m) => ({ ...m, [id]: true }));
    try {
      const res = await fetchWithAuth('/api/covers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: id }),
      });
      if (!res.ok) {
        // optional: surface error toast
        return;
      }
      setPurchased((p) => ({ ...p, [id]: true }));
    } finally {
      setLoading((m) => ({ ...m, [id]: false }));
    }
  };

  return (
    <div style={{ background: '#f3f6fb' }}>
      <main className="max-w-5xl mx-auto px-6 pt-10 pb-20">
        <h1 className="text-center text-5xl font-extrabold tracking-tight text-slate-900">Commander’s Emporium</h1>
        <p className="mt-2 text-center text-lg text-slate-600">Spend your tokens on stylish cosmetic upgrades.</p>

  {/* Mock data banner removed per request */}

        <div className="mt-8 flex flex-col items-center">
          <button className="rounded-full bg-blue-100 text-blue-700 px-6 py-2 font-semibold text-base mb-2 shadow-sm">
            Cosmetic Inventory
          </button>
        </div>

        {cosmeticCategories.map((category) => {
          const categoryUnlocked = commanderLevel >= category.unlockLevel;
          return (
            <section key={category.title} className="mt-12">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">{category.title}</h2>
              {!categoryUnlocked ? (
                <p className="text-slate-500">Unlocks at Commander Level {category.unlockLevel}</p>
              ) : category.items.length === 0 ? (
                <p className="text-slate-500">No items available yet.</p>
              ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {category.items.map((item) => {
                    // Item is locked if commanderLevel is below the category unlock level OR below an item-specific unlock level
                    const unlockLevel = Math.max(category.unlockLevel, item.unlockLevel ?? category.unlockLevel);
                    const locked = commanderLevel < unlockLevel;
    const id = item.id ?? (item.title.includes('Sunrise') ? 'Sunrise' : item.title);
                    return (
                      <ShopCard
                        key={item.title}
                        {...item}
                        locked={locked}
                        unlockLevel={unlockLevel}
            purchased={!!purchased[id]}
            loading={!!loading[id]}
            onPurchase={() => handlePurchase(id)}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
