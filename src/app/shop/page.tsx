"use client";
import React, { useState } from "react";
import ShopCard from "../../components/shop/ShopCard";

const cosmeticCategories = [
  {
    name: "Deck Covers",
    unlockLevel: 3,
    items: [
      {
        title: "Sunrise Cover",
        description: "Start your study session with the warm glow of dawn.",
        price: 80,
        unlockLevel: 3,
        image: (
          <div className="h-24 w-full bg-gradient-to-br from-orange-400 via-pink-400 to-purple-500" />
        ),
      },
    ],
  },
  {
    name: "Avatar Frames",
    unlockLevel: 4,
    items: [],
  },
  {
    name: "Page Backgrounds",
    unlockLevel: 6,
    items: [],
  },
];

export default function ShopPage() {
  const [preview, setPreview] = useState(true);
  const commanderLevel = 3;
  return (
    <div style={{ background: "#f3f6fb" }}>
      <main className="max-w-5xl mx-auto px-6 pt-10 pb-20">
        <h1 className="text-center text-5xl font-extrabold tracking-tight text-slate-900">Commander’s Boutique</h1>
        <p className="mt-2 text-center text-lg text-slate-600">Spend your tokens on stylish cosmetic upgrades.</p>
        <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-center">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-500 mr-3">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z" />
            </svg>
          </span>
          <span className="text-blue-700 font-medium">Viewing Mock Data</span>
          <span className="ml-2 text-blue-600">This is a preview of the shop. Please <a href="#" className="underline">log in</a> to make purchases.</span>
        </div>
        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="text-slate-700 text-base">Preview mode</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={preview} onChange={() => setPreview(!preview)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 transition-all"></div>
            <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all peer-checked:translate-x-5"></div>
          </label>
        </div>
        {cosmeticCategories.map((cat) => (
          <section key={cat.name} className="mt-10">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{cat.name}</h2>
            {commanderLevel < cat.unlockLevel ? (
              <p className="text-slate-500">Unlocks at Commander Level {cat.unlockLevel}</p>
            ) : cat.items.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {cat.items.map((item) => (
                  <ShopCard
                    key={item.title}
                    title={item.title}
                    description={item.description}
                    price={item.price}
                    image={item.image}
                    preview={preview}
                    locked={commanderLevel < item.unlockLevel}
                    unlockLevel={item.unlockLevel}
                  />
                ))}
              </div>
            ) : (
              <p className="text-slate-500">More cosmetics coming soon...</p>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
