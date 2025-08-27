"use client";
import React from "react";
import ShopCard, { ShopCardProps } from "../../components/shop/ShopCard";

type Category = {
  title: string;
  unlockLevel: number;
  items: ShopCardProps[];
};

const cosmeticCategories: Category[] = [
  {
    title: "Deck Covers",
    unlockLevel: 3,
    items: [
      {
        title: "Sunrise Cover",
        description: "Brighten your deck with a warm sunrise gradient.",
        price: 80,
        icon: (
          <div className="h-24 w-full rounded-lg bg-gradient-to-br from-orange-300 via-pink-300 to-yellow-200" />
        ),
      },
    ],
  },
  {
    title: "Avatar Frames",
    unlockLevel: 4,
    items: [],
  },
  {
    title: "Page Backgrounds",
    unlockLevel: 6,
    items: [],
  },
];

export default function ShopPage() {
  const commanderLevel = 3; // mock commander level for preview

  return (
    <div style={{ background: '#f3f6fb' }}>
      <main className="max-w-5xl mx-auto px-6 pt-10 pb-20">
        <h1 className="text-center text-5xl font-extrabold tracking-tight text-slate-900">Commander’s Emporium</h1>
        <p className="mt-2 text-center text-lg text-slate-600">Spend your tokens on stylish cosmetic upgrades.</p>

        <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-center">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-500 mr-3">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z" />
            </svg>
          </span>
          <span className="text-blue-700 font-medium">Viewing Mock Data</span>
          <span className="ml-2 text-blue-600">
            This is a preview of the shop. Please <a href="#" className="underline">log in</a> to make purchases.
          </span>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <button className="rounded-full bg-blue-100 text-blue-700 px-6 py-2 font-semibold text-base mb-2 shadow-sm">
            Cosmetic Inventory
          </button>
        </div>

        {cosmeticCategories.map((category) => {
          const unlocked = commanderLevel >= category.unlockLevel;
          return (
            <section key={category.title} className="mt-12">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">{category.title}</h2>
              {!unlocked ? (
                <p className="text-slate-500">Unlocks at Commander Level {category.unlockLevel}</p>
              ) : category.items.length === 0 ? (
                <p className="text-slate-500">No items available yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {category.items.map((item) => (
                    <ShopCard key={item.title} {...item} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
