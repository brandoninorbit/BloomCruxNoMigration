

"use client";
import React from "react";

export type ShopCardProps = {
  title: string;
  description: string;
  price: number;
  soon?: boolean;
  icon: React.ReactNode;
  preview: boolean;
};

export default function ShopCard({ title, description, price, soon, icon, preview }: ShopCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-4">
        {icon}
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-1">{title}</h2>
      <p className="text-sm leading-6 text-slate-600 mb-2">
        {description}
        {soon && <span className="ml-2 text-xs text-orange-600">(Feature coming soon)</span>}
      </p>
      <button
        className="w-full rounded-xl bg-[#2481f9] px-4 py-3 text-white text-sm font-semibold opacity-80"
        disabled={preview}
        style={{ minHeight: '48px' }}
      >
        {price} tokens
      </button>
    </div>
  );
}
