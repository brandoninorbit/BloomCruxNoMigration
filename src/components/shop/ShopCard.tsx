"use client";
import React from "react";

export type ShopCardProps = {
  title: string;
  description: string;
  price: number;
  icon: React.ReactNode;
  disabled?: boolean;
};

export default function ShopCard({ title, description, price, icon, disabled }: ShopCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm leading-6 text-slate-600 mb-4">{description}</p>
      <button
        className="w-full rounded-xl bg-[#2481f9] px-4 py-3 text-white text-sm font-semibold disabled:opacity-50"
        disabled={disabled}
      >
        {price} tokens
      </button>
    </div>
  );
}
