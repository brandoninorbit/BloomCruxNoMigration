"use client";
import React from "react";
import { SunriseCover } from '@/components/DeckCovers';
import { fetchWithAuth } from '@/lib/supabase/fetchWithAuth';
import { getUnlockLevelById } from '@/lib/unlocks';

const SUNRISE_ID = "Sunrise";
const SUNRISE_UNLOCK_LEVEL = getUnlockLevelById(SUNRISE_ID) ?? 2;

export default function DevDeckCoversPage() {
  const [commanderLevel, setCommanderLevel] = React.useState<number | null>(null);
  const [purchased, setPurchased] = React.useState<boolean | null>(null);
  const [defaultCover, setDefaultCover] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [devUnlockPreview, setDevUnlockPreview] = React.useState<boolean>(false);

  const unlocked = (commanderLevel ?? 0) >= SUNRISE_UNLOCK_LEVEL;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load commander level
  const w = await fetchWithAuth('/api/economy/wallet', { cache: 'no-store' });
        if (w.ok) {
          const j = await w.json();
          const lvl = Number(j?.commander_level ?? 0);
          if (!cancelled) setCommanderLevel(Number.isFinite(lvl) ? lvl : 0);
        } else {
          if (!cancelled) setCommanderLevel(0);
        }

        // Load purchased state
  const p = await fetchWithAuth(`/api/covers/purchased?coverId=${encodeURIComponent(SUNRISE_ID)}`, { cache: 'no-store' });
        if (p.ok) {
          const j = await p.json();
          if (!cancelled) setPurchased(!!j?.purchased);
        } else if (p.status === 401) {
          if (!cancelled) setPurchased(false);
        }

        // Load default cover
  const d = await fetchWithAuth('/api/covers/default', { cache: 'no-store' });
        if (d.ok) {
          const j = await d.json();
          if (!cancelled) setDefaultCover(j?.defaultCover ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
    // Load dev override
    try {
      const v = localStorage.getItem('dc:dev:unlockPreviews');
      setDevUnlockPreview(v === '1');
    } catch {}
    return () => { cancelled = true; };
  }, []);

  // Persist dev override
  React.useEffect(() => {
    try { localStorage.setItem('dc:dev:unlockPreviews', devUnlockPreview ? '1' : '0'); } catch {}
  }, [devUnlockPreview]);

  const doPurchase = async () => {
    setError(null);
    setLoading(true);
    try {
  // Dev: allow purchase regardless of level to test on low-level accounts
  const res = await fetchWithAuth('/api/covers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: SUNRISE_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Purchase failed (${res.status})`);
      }
      setPurchased(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const setDefault = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!purchased) throw new Error('You must purchase first');
  const res = await fetchWithAuth('/api/covers/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: SUNRISE_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Set default failed (${res.status})`);
      }
      setDefaultCover(SUNRISE_ID);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Set default failed');
    } finally {
      setLoading(false);
    }
  };

  const resetDev = async () => {
    setError(null);
    setLoading(true);
    try {
  const res = await fetchWithAuth('/api/covers/dev/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: SUNRISE_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Reset failed (${res.status})`);
      }
      setPurchased(false);
      setDefaultCover((cur) => (cur === SUNRISE_ID ? null : cur));
  setDevUnlockPreview(false);
  try { localStorage.removeItem('dc:dev:unlockPreviews'); } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Dev — Deck Covers</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="font-medium mb-2">Sunrise (unlock at Commander L{SUNRISE_UNLOCK_LEVEL})</h2>
          <p className="text-sm text-gray-500 mb-4">Use real endpoints to purchase and set default. Requires login.</p>

          <div className="space-y-2 text-sm">
            <div>Commander level: {commanderLevel ?? '…'}</div>
            <div>Unlocked: {unlocked ? 'yes' : 'no'}</div>
            <div>Purchased: {purchased == null ? '…' : purchased ? 'yes' : 'no'}</div>
            <div>Default cover: {defaultCover ?? '(none)'}</div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={doPurchase}
              disabled={loading || !!purchased}
              className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {purchased ? 'Purchased' : 'Force Purchase (dev)'}
            </button>
            <button
              type="button"
              onClick={setDefault}
              disabled={loading || !purchased || defaultCover === SUNRISE_ID}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {defaultCover === SUNRISE_ID ? 'Default set' : 'Set as default'}
            </button>
            <label className="inline-flex items-center gap-2 text-sm ml-2">
              <input
                type="checkbox"
                checked={devUnlockPreview}
                onChange={(e) => setDevUnlockPreview(e.target.checked)}
              />
              <span>Dev unlock previews (override level)</span>
            </label>
            <button
              type="button"
              onClick={resetDev}
              disabled={loading}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Reset (dev)
            </button>
          </div>
        </div>

        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="font-medium mb-2">Preview</h2>
          <div className="mt-4">
            {(unlocked || devUnlockPreview) ? (
              <SunriseCover className="w-full" />
            ) : (
              <div className="w-full h-28 rounded-md bg-slate-100" aria-hidden />
            )}
            {!unlocked && !devUnlockPreview && (
              <div className="mt-3 text-sm text-amber-600">Locked — reach Commander Level {SUNRISE_UNLOCK_LEVEL} to preview, or enable Dev unlock previews.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
