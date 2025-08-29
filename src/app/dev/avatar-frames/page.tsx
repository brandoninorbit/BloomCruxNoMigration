"use client";
import React from 'react';
import { AvatarFrameNeonGlow } from '@/components/AvatarFrames';
import { fetchWithAuth } from '@/lib/supabase/fetchWithAuth';
import { getUnlockLevelById } from '@/lib/unlocks';

const NEON_ID = 'NeonGlow';
const NEON_UNLOCK = getUnlockLevelById('AvatarFrames') ?? 4;

export default function DevAvatarFramesPage() {
  const [commanderLevel, setCommanderLevel] = React.useState<number | null>(null);
  const [purchased, setPurchased] = React.useState<boolean | null>(null);
  const [devUnlockPreview, setDevUnlockPreview] = React.useState<boolean>(false);
  const [devForcePurchase, setDevForcePurchase] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const w = await fetchWithAuth('/api/economy/wallet', { cache: 'no-store' });
        if (w.ok) {
          const j = await w.json();
          if (!cancelled) setCommanderLevel(Number(j?.commander_level ?? 0));
        } else {
          if (!cancelled) setCommanderLevel(0);
        }

        const p = await fetchWithAuth(`/api/covers/purchased?coverId=${encodeURIComponent(NEON_ID)}`, { cache: 'no-store' });
        if (p.ok) {
          const j = await p.json();
          if (!cancelled) setPurchased(!!j?.purchased);
        } else if (p.status === 401) {
          if (!cancelled) setPurchased(false);
        }
      } catch (e) {
        if (!cancelled) setPurchased(false);
      }
    })();

    try {
      const v = localStorage.getItem('dc:dev:avatarFrames:unlockPreviews');
      setDevUnlockPreview(v === '1');
    } catch {}
    try {
      const f = localStorage.getItem('dc:dev:avatarFrames:forcePurchase');
      setDevForcePurchase(f === '1');
    } catch {}

    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => { try { localStorage.setItem('dc:dev:avatarFrames:unlockPreviews', devUnlockPreview ? '1' : '0'); } catch {} }, [devUnlockPreview]);
  React.useEffect(() => { try { localStorage.setItem('dc:dev:avatarFrames:forcePurchase', devForcePurchase ? '1' : '0'); } catch {} }, [devForcePurchase]);

  const unlocked = devUnlockPreview || (commanderLevel ?? 0) >= NEON_UNLOCK;
  const effectivePurchased = devForcePurchase || !!purchased;

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Dev: Avatar Frames</h1>
      <p>Commander level: {commanderLevel ?? '(loading)'}</p>
      <p>Unlocked: {unlocked ? 'yes' : 'no'}</p>
      <p>Purchased: {effectivePurchased ? 'yes' : 'no'}</p>

      <div className="mt-6 flex gap-3 items-center">
        <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={() => setDevForcePurchase(true)}>Force Purchase (dev)</button>
        <button className="px-4 py-2 rounded border" onClick={() => setDevForcePurchase(false)}>Reset Force</button>
        <label className="ml-4 flex items-center gap-2">
          <input type="checkbox" checked={devUnlockPreview} onChange={(e) => setDevUnlockPreview(e.target.checked)} />
          Dev unlock previews (override level)
        </label>
      </div>

      <div className="mt-8">
        <h2 className="font-semibold mb-2">Preview</h2>
        <div className="w-32 h-32">
          <AvatarFrameNeonGlow sizeClass="w-32 h-32" />
        </div>
      </div>
    </main>
  );
}
