

"use client";
import React from "react";

export type ShopCardProps = {
  title: string;
  description: string;
  price: number;
  image: React.ReactNode;
  preview: boolean;
  locked?: boolean;
  unlockLevel?: number;
};

export default function ShopCard({
  title,
  description,
  price,
  image,
  preview,
  locked,
  unlockLevel,
}: ShopCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="mb-4 overflow-hidden rounded-xl">{image}</div>
      <h2 className="text-xl font-semibold text-slate-800 mb-1">{title}</h2>
      <p className="text-sm leading-6 text-slate-600 mb-2">
        {description}
      </p>
      <button
        className="w-full rounded-xl bg-[#2481f9] px-4 py-3 text-white text-sm font-semibold opacity-80"
        disabled={preview || locked}
        style={{ minHeight: '48px' }}
      >
        {locked ? `Unlocks at L${unlockLevel}` : `${price} tokens`}
      </button>
    </div>
  );
}
