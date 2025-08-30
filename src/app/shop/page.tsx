"use client";
import React, { useEffect, useState } from "react";
import ShopCard, { ShopCardProps } from "../../components/shop/ShopCard";
import { DeckCoverDeepSpace, DeckCoverNightMission, DeckCoverAgentStealth, DeckCoverRainforest, DeckCoverDesertStorm } from "@/components/DeckCovers";
import { AvatarFrameNeonGlow } from '@/components/AvatarFrames';
import { fetchWithAuth } from "@/lib/supabase/fetchWithAuth";
import { CATEGORY_UNLOCK_LEVELS, UNLOCKS } from "@/lib/unlocks";
import { COSMETIC_PRICES } from '@/lib/cosmeticPrices';

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
        price: COSMETIC_PRICES.Sunrise,
        icon: (
          <div className="h-24 w-full rounded-lg bg-gradient-to-br from-orange-300 via-pink-300 to-yellow-200" />
        ),
      },
      {
        id: "DeepSpace",
        title: "Deep Space Cover",
        description: "A tranquil starfield with subtle parallax and twinkle.",
        price: COSMETIC_PRICES.DeepSpace,
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
        price: COSMETIC_PRICES.NightMission,
        icon: (
          <div className="h-24 w-full rounded-lg overflow-hidden">
            <DeckCoverNightMission fill className="h-24 w-full rounded-lg" />
          </div>
        ),
      },
      {
        id: "AgentStealth",
        title: "Agent Stealth Cover",
        description: "Tactical radar sweep over a dark grid with pulsing blips.",
        price: COSMETIC_PRICES.AgentStealth,
        icon: (
          <div className="h-24 w-full rounded-lg overflow-hidden">
            <DeckCoverAgentStealth fill className="h-24 w-full rounded-lg" />
          </div>
        ),
      },
      {
        id: "Rainforest",
        title: "Rainforest Cover",
        description: "Lush layered foliage with sway, fog, and insect glints.",
        price: COSMETIC_PRICES.Rainforest,
        icon: (
          <div className="h-24 w-full rounded-lg overflow-hidden">
            <DeckCoverRainforest fill={true} className="h-24 w-full rounded-lg" />
          </div>
        ),
      },
      {
        id: "DesertStorm",
        title: "Desert Storm Cover",
        description: "Desert storm with drifting sand and heat haze. Costs 150 tokens.",
        price: COSMETIC_PRICES.DesertStorm, // Price in tokens
        icon: (
          <div className="h-24 w-full rounded-lg overflow-hidden">
            <DeckCoverDesertStorm fill className="h-24 w-full rounded-lg" />
          </div>
        ),
      },
    ],
  },
  {
    title: "Avatar Frames",
  unlockLevel: CATEGORY_UNLOCK_LEVELS.AvatarFrames,
    items: [
      {
        id: "NeonGlow",
        title: "Neon Glow Frame",
        description: "Vibrant neon rim with animated glow and pulse.",
        price: COSMETIC_PRICES.NeonGlow,
        icon: (
          <div className="h-24 w-full rounded-lg overflow-hidden flex items-center justify-center">
            <AvatarFrameNeonGlow sizeClass="w-20 h-20" />
          </div>
        ),
      },
    ],
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
  const [devUnlock, setDevUnlock] = useState(false);

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
  const ids = ["Sunrise", "DeepSpace", "NightMission", "AgentStealth", "Rainforest", "DesertStorm", "NeonGlow"] as const;
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

  // Check local storage for dev unlock
  useEffect(() => {
    const checkDevUnlock = () => {
      // support both keys set by the dev page: legacy 'devUnlockDeckCovers' and namespaced 'dc:dev:unlockPreviews'
      const deckDev = localStorage.getItem('devUnlockDeckCovers') === 'true' || localStorage.getItem('dc:dev:unlockPreviews') === '1';
      // avatar frames dev keys
      const avatarDev = localStorage.getItem('dc:dev:avatarFrames:unlockPreviews') === '1';
      const avatarForce = localStorage.getItem('dc:dev:avatarFrames:forcePurchase') === '1';
      setDevUnlock(deckDev || avatarDev);
      // apply force purchase for avatars if present
      if (avatarForce) setPurchased((p) => ({ ...p, NeonGlow: true }));
    };

    // Check on mount
    checkDevUnlock();

    // Listen for storage changes (cross-tab)
    window.addEventListener('storage', checkDevUnlock);

    // Also check on window focus (for same-tab changes)
    window.addEventListener('focus', checkDevUnlock);

    return () => {
      window.removeEventListener('storage', checkDevUnlock);
      window.removeEventListener('focus', checkDevUnlock);
    };
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

  // Update the unlock check logic is handled inline when rendering

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
          const categoryUnlocked = devUnlock ? true : commanderLevel >= category.unlockLevel;
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
                    // Resolve the item's own unlock level from central UNLOCKS by id
                    const central = UNLOCKS.find(u => u.id === (item.id ?? item.title));
                    const itemUnlockLevel = typeof central?.level === 'number' ? central.level : category.unlockLevel;
                    // Item is locked if commanderLevel is below the category unlock level OR below item-specific unlock level
                    const unlockLevel = Math.max(category.unlockLevel, itemUnlockLevel);
                    const locked = devUnlock ? false : commanderLevel < unlockLevel;
    const id = item.id ?? (item.title.includes('Sunrise') ? 'Sunrise' : item.title);
                    return (
                      <ShopCard
                        key={item.title}
                        {...item}
                        locked={locked}
                        unlockLevel={unlockLevel}
                        commanderLevel={commanderLevel}
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
