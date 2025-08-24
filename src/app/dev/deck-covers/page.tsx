"use client";
import React from "react";
import { SunriseCover } from '@/components/DeckCovers';

export default function DevDeckCoversPage() {
  // start with stable defaults so server and client markup match; hydrate from localStorage in effect
  const [unlocked, setUnlocked] = React.useState<boolean>(false);
  const [purchased, setPurchased] = React.useState<boolean>(false);

  // Read persisted dev toggles once on mount (client-only)
  React.useEffect(() => {
    try {
      const u = localStorage.getItem('dc:Sunrise:unlocked') === '1';
      const p = localStorage.getItem('dc:Sunrise:purchased') === '1';
      setUnlocked(u);
      setPurchased(p);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist changes
  React.useEffect(() => { try { localStorage.setItem('dc:Sunrise:unlocked', unlocked ? '1' : '0'); } catch {} }, [unlocked]);
  React.useEffect(() => { try { localStorage.setItem('dc:Sunrise:purchased', purchased ? '1' : '0'); } catch {} }, [purchased]);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-4">Dev — Deck Covers</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="font-medium mb-2">Sunrise (commander unlock: L3)</h2>
          <p className="text-sm text-gray-500 mb-4">Toggle unlock/purchase state for the Sunrise cover used in development.</p>
          <div className="flex items-center gap-4 mb-4">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={unlocked} onChange={(e) => setUnlocked(e.target.checked)} />
              <span>Unlocked</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={purchased} onChange={(e) => setPurchased(e.target.checked)} />
              <span>Purchased</span>
            </label>
          </div>
          <div className="mb-2 text-sm text-gray-600">Current state:</div>
          <div className="text-sm">Unlocked: {unlocked ? 'yes' : 'no'} — Purchased: {purchased ? 'yes' : 'no'}</div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="font-medium mb-2">Preview</h2>
          <div className="mt-4">
            <SunriseCover className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
