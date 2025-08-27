"use client";
import React from "react";

export type ShopCardProps = {
  title: string;
  description: string;
  price: number;
  icon: React.ReactNode;
  disabled?: boolean;
  /** When true, preview should be blank and purchase disabled. */
  locked?: boolean;
  /** Optional: shows the level needed when locked. */
  unlockLevel?: number;
  /** If already purchased, disable button and show status. */
  purchased?: boolean;
  /** Optional click handler to perform the purchase. */
  onPurchase?: () => void | Promise<void>;
  /** Optional loading state for the CTA button. */
  loading?: boolean;
};

export default function ShopCard({ title, description, price, icon, disabled, locked, unlockLevel, purchased, onPurchase, loading }: ShopCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="mb-4">
        {locked ? (
          <div className="h-24 w-full rounded-lg bg-slate-100" aria-hidden />
        ) : (
          icon
        )}
      </div>
      <h3 className="text-xl font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm leading-6 text-slate-600 mb-4">{description}</p>
      <button
        className="w-full rounded-xl bg-[#2481f9] px-4 py-3 text-white text-sm font-semibold disabled:opacity-50"
        disabled={disabled || locked || purchased || loading}
        onClick={() => {
          if (disabled || locked || purchased || loading) return;
          onPurchase?.();
        }}
      >
        {locked
          ? (unlockLevel ? `Unlocks at Level ${unlockLevel}` : "Locked")
          : purchased
          ? 'Purchased'
          : loading
          ? 'Processing…'
          : `${price} tokens`}
      </button>
    </div>
  );
}
