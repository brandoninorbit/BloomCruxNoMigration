"use client";
import React from "react";

export type ShopCardProps = {
  /** Stable ID for purchase and unlock checks (e.g., 'Sunrise', 'DeepSpace'). */
  id?: string;
  title: string;
  description: string;
  price: number;
  icon: React.ReactNode;
  disabled?: boolean;
  /** When true, preview should be blank and purchase disabled. */
  locked?: boolean;
  /** Optional: shows the level needed when locked. */
  unlockLevel?: number;
  /** Current commander level to determine if this is the next unlock */
  commanderLevel?: number;
  /** If already purchased, disable button and show status. */
  purchased?: boolean;
  /** Optional click handler to perform the purchase. */
  onPurchase?: () => void | Promise<void>;
  /** Optional loading state for the CTA button. */
  loading?: boolean;
};

export default function ShopCard({ title, description, price, icon, disabled, locked, unlockLevel, commanderLevel, purchased, onPurchase, loading }: ShopCardProps) {
  // Determine if this locked item is the next unlock or not
  const isNotNextUnlock = locked && unlockLevel && commanderLevel !== undefined && unlockLevel > (commanderLevel + 1);
  
  // For non-next unlocks, show encrypted text
  const displayTitle = isNotNextUnlock ? "Encrypted cosmetic // Decrypt at higher Commander level" : title;
  const displayUnlockText = isNotNextUnlock ? "Unlocks at: Encrypted unlock data // Decrypt at higher Commander level" : `Unlocks at Level ${unlockLevel}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="mb-4">
        {locked ? (
          <div className="h-24 w-full rounded-lg bg-slate-100" aria-hidden />
        ) : (
          icon
        )}
      </div>
      <h3 className="text-xl font-semibold text-slate-800 mb-1">{displayTitle}</h3>
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
          ? (unlockLevel ? displayUnlockText : "Locked")
          : purchased
          ? 'Purchased'
          : loading
          ? 'Processing…'
          : `${price} tokens`}
      </button>
    </div>
  );
}
