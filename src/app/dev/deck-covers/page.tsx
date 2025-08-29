"use client";
import React from "react";
import { SunriseCover, DeckCoverDeepSpace, DeckCoverNightMission, DeckCoverAgentStealth, DeckCoverRainforest, DeckCoverDesertStorm } from '@/components/DeckCovers';
import { fetchWithAuth } from '@/lib/supabase/fetchWithAuth';
import { getUnlockLevelById } from '@/lib/unlocks';

const SUNRISE_ID = "Sunrise";
const SUNRISE_UNLOCK_LEVEL = getUnlockLevelById(SUNRISE_ID) ?? 2;
const DEEP_ID = "DeepSpace";
const DEEP_UNLOCK_LEVEL = getUnlockLevelById(DEEP_ID) ?? 3;
const NIGHT_ID = "NightMission";
const NIGHT_UNLOCK_LEVEL = getUnlockLevelById(NIGHT_ID) ?? 5;
const STEALTH_ID = "AgentStealth";
const STEALTH_UNLOCK_LEVEL = getUnlockLevelById(STEALTH_ID) ?? 8;
const RAINFOREST_ID = "Rainforest";
const RAINFOREST_UNLOCK_LEVEL = getUnlockLevelById(RAINFOREST_ID) ?? 11;
const DESERT_STORM_ID = "DesertStorm";
const DESERT_STORM_UNLOCK_LEVEL = getUnlockLevelById(DESERT_STORM_ID) ?? 13;

export default function DevDeckCoversPage() {
  const [commanderLevel, setCommanderLevel] = React.useState<number | null>(null);
  const [purchased, setPurchased] = React.useState<boolean | null>(null);
  const [purchasedDeep, setPurchasedDeep] = React.useState<boolean | null>(null);
  const [purchasedNight, setPurchasedNight] = React.useState<boolean | null>(null);
  const [purchasedStealth, setPurchasedStealth] = React.useState<boolean | null>(null);
  const [purchasedRainforest, setPurchasedRainforest] = React.useState<boolean | null>(null);
  const [purchasedDesertStorm, setPurchasedDesertStorm] = React.useState<boolean | null>(null);
  const [defaultCover, setDefaultCover] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [devUnlockPreview, setDevUnlockPreview] = React.useState<boolean>(false);

  const unlocked = devUnlockPreview || (commanderLevel ?? 0) >= SUNRISE_UNLOCK_LEVEL;
  const unlockedDeep = devUnlockPreview || (commanderLevel ?? 0) >= DEEP_UNLOCK_LEVEL;
  const unlockedNight = devUnlockPreview || (commanderLevel ?? 0) >= NIGHT_UNLOCK_LEVEL;
  const unlockedStealth = devUnlockPreview || (commanderLevel ?? 0) >= STEALTH_UNLOCK_LEVEL;
  const unlockedRainforest = devUnlockPreview || (commanderLevel ?? 0) >= RAINFOREST_UNLOCK_LEVEL;
  const unlockedDesertStorm = devUnlockPreview || (commanderLevel ?? 0) >= DESERT_STORM_UNLOCK_LEVEL;

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

        // Load purchased state (Sunrise)
  const p = await fetchWithAuth(`/api/covers/purchased?coverId=${encodeURIComponent(SUNRISE_ID)}`, { cache: 'no-store' });
        if (p.ok) {
          const j = await p.json();
          if (!cancelled) setPurchased(!!j?.purchased);
        } else if (p.status === 401) {
          if (!cancelled) setPurchased(false);
        }

        // Load purchased state (Deep Space)
  const p2 = await fetchWithAuth(`/api/covers/purchased?coverId=${encodeURIComponent(DEEP_ID)}`, { cache: 'no-store' });
        if (p2.ok) {
          const j = await p2.json();
          if (!cancelled) setPurchasedDeep(!!j?.purchased);
        } else if (p2.status === 401) {
          if (!cancelled) setPurchasedDeep(false);
        }

        // Load purchased state (Night Mission)
  const p3 = await fetchWithAuth(`/api/covers/purchased?coverId=${encodeURIComponent(NIGHT_ID)}`, { cache: 'no-store' });
        if (p3.ok) {
          const j = await p3.json();
          if (!cancelled) setPurchasedNight(!!j?.purchased);
        } else if (p3.status === 401) {
          if (!cancelled) setPurchasedNight(false);
        }

        // Load purchased state (Agent Stealth)
  const p4 = await fetchWithAuth(`/api/covers/purchased?coverId=${encodeURIComponent(STEALTH_ID)}`, { cache: 'no-store' });
        if (p4.ok) {
          const j = await p4.json();
          if (!cancelled) setPurchasedStealth(!!j?.purchased);
        } else if (p4.status === 401) {
          if (!cancelled) setPurchasedStealth(false);
        }

        // Load purchased state (Rainforest)
  const p5 = await fetchWithAuth(`/api/covers/purchased?coverId=${encodeURIComponent(RAINFOREST_ID)}`, { cache: 'no-store' });
        if (p5.ok) {
          const j = await p5.json();
          if (!cancelled) setPurchasedRainforest(!!j?.purchased);
        } else if (p5.status === 401) {
          if (!cancelled) setPurchasedRainforest(false);
        }

        // Load purchased state (Desert Storm)
  const p6 = await fetchWithAuth(`/api/covers/purchased?coverId=${encodeURIComponent(DESERT_STORM_ID)}`, { cache: 'no-store' });
        if (p6.ok) {
          const j = await p6.json();
          if (!cancelled) setPurchasedDesertStorm(!!j?.purchased);
        } else if (p6.status === 401) {
          if (!cancelled) setPurchasedDesertStorm(false);
        }
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

  React.useEffect(() => {
    localStorage.setItem('devUnlockDeckCovers', devUnlockPreview ? 'true' : 'false');
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

  const doPurchaseDeep = async () => {
    setError(null);
    setLoading(true);
    try {
  // Dev: allow purchase regardless of level to test on low-level accounts
  const res = await fetchWithAuth('/api/covers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: DEEP_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Purchase failed (${res.status})`);
      }
      setPurchasedDeep(true);
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

  const setDefaultDeep = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!purchasedDeep) throw new Error('You must purchase first');
  const res = await fetchWithAuth('/api/covers/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: DEEP_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Set default failed (${res.status})`);
      }
      setDefaultCover(DEEP_ID);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Set default failed');
    } finally {
      setLoading(false);
    }
  };

  const doPurchaseNight = async () => {
    setError(null);
    setLoading(true);
    try {
  const res = await fetchWithAuth('/api/covers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: NIGHT_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Purchase failed (${res.status})`);
      }
      setPurchasedNight(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const setDefaultNight = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!purchasedNight) throw new Error('You must purchase first');
  const res = await fetchWithAuth('/api/covers/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: NIGHT_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Set default failed (${res.status})`);
      }
      setDefaultCover(NIGHT_ID);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Set default failed');
    } finally {
      setLoading(false);
    }
  };

  const resetDevNight = async () => {
    setError(null);
    setLoading(true);
    try {
  const res = await fetchWithAuth('/api/covers/dev/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: NIGHT_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Reset failed (${res.status})`);
      }
      setPurchasedNight(false);
      setDefaultCover((cur) => (cur === NIGHT_ID ? null : cur));
  setDevUnlockPreview(false);
  try { localStorage.removeItem('dc:dev:unlockPreviews'); } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const doPurchaseStealth = async () => {
    setError(null);
    setLoading(true);
    try {
  const res = await fetchWithAuth('/api/covers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: STEALTH_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Purchase failed (${res.status})`);
      }
      setPurchasedStealth(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const setDefaultStealth = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!purchasedStealth) throw new Error('You must purchase first');
  const res = await fetchWithAuth('/api/covers/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: STEALTH_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Set default failed (${res.status})`);
      }
      setDefaultCover(STEALTH_ID);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Set default failed');
    } finally {
      setLoading(false);
    }
  };

  const resetDevStealth = async () => {
    setError(null);
    setLoading(true);
    try {
  const res = await fetchWithAuth('/api/covers/dev/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: STEALTH_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Reset failed (${res.status})`);
      }
      setPurchasedStealth(false);
      setDefaultCover((cur) => (cur === STEALTH_ID ? null : cur));
  setDevUnlockPreview(false);
  try { localStorage.removeItem('dc:dev:unlockPreviews'); } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const doPurchaseRainforest = async () => {
    setError(null);
    setLoading(true);
    try {
  const res = await fetchWithAuth('/api/covers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: RAINFOREST_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Purchase failed (${res.status})`);
      }
      setPurchasedRainforest(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const setDefaultRainforest = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!purchasedRainforest) throw new Error('You must purchase first');
  const res = await fetchWithAuth('/api/covers/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: RAINFOREST_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Set default failed (${res.status})`);
      }
      setDefaultCover(RAINFOREST_ID);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Set default failed');
    } finally {
      setLoading(false);
    }
  };

  const resetDevRainforest = async () => {
    setError(null);
    setLoading(true);
    try {
  const res = await fetchWithAuth('/api/covers/dev/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: RAINFOREST_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Reset failed (${res.status})`);
      }
      setPurchasedRainforest(false);
      setDefaultCover((cur) => (cur === RAINFOREST_ID ? null : cur));
      setDevUnlockPreview(false);
      try { localStorage.removeItem('dc:dev:unlockPreviews'); } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const doPurchaseDesertStorm = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/covers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: DESERT_STORM_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Purchase failed (${res.status})`);
      }
      setPurchasedDesertStorm(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const setDefaultDesertStorm = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!purchasedDesertStorm) throw new Error('You must purchase first');
      const res = await fetchWithAuth('/api/covers/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: DESERT_STORM_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Set default failed (${res.status})`);
      }
      setDefaultCover(DESERT_STORM_ID);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Set default failed');
    } finally {
      setLoading(false);
    }
  };

  const resetDevDesertStorm = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/covers/dev/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: DESERT_STORM_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Reset failed (${res.status})`);
      }
      setPurchasedDesertStorm(false);
      setDefaultCover((cur) => (cur === DESERT_STORM_ID ? null : cur));
      setDevUnlockPreview(false);
      try { localStorage.removeItem('dc:dev:unlockPreviews'); } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
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

  const resetDevDeep = async () => {
    setError(null);
    setLoading(true);
    try {
  const res = await fetchWithAuth('/api/covers/dev/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverId: DEEP_ID }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        const msg = (j && typeof j === 'object' && 'error' in j) ? String((j as { error?: string }).error) : '';
        throw new Error(msg || `Reset failed (${res.status})`);
      }
      setPurchasedDeep(false);
      setDefaultCover((cur) => (cur === DEEP_ID ? null : cur));
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

            {/* Agent Stealth controls */}
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="font-medium mb-2">Agent Stealth (unlock at Commander L{STEALTH_UNLOCK_LEVEL})</h2>
              <p className="text-sm text-gray-500 mb-4">Use real endpoints to purchase and set default. Requires login.</p>

              <div className="space-y-2 text-sm">
                <div>Commander level: {commanderLevel ?? '…'}</div>
                <div>Unlocked: {unlockedStealth ? 'yes' : 'no'}</div>
                <div>Purchased: {purchasedStealth == null ? '…' : purchasedStealth ? 'yes' : 'no'}</div>
                <div>Default cover: {defaultCover ?? '(none)'}</div>
              </div>

              {error && (
                <div className="mt-3 text-sm text-red-600">{error}</div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={doPurchaseStealth}
                  disabled={loading || !!purchasedStealth}
                  className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {purchasedStealth ? 'Purchased' : 'Force Purchase (dev)'}
                </button>
                <button
                  type="button"
                  onClick={setDefaultStealth}
                  disabled={loading || !purchasedStealth || defaultCover === STEALTH_ID}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {defaultCover === STEALTH_ID ? 'Default set' : 'Set as default'}
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
                  onClick={resetDevStealth}
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
                {(unlockedStealth || devUnlockPreview) ? (
                  <DeckCoverAgentStealth className="w-full" />
                ) : (
                  <div className="w-full h-28 rounded-md bg-slate-100" aria-hidden />
                )}
                {!unlockedStealth && !devUnlockPreview && (
                  <div className="mt-3 text-sm text-amber-600">Locked — reach Commander Level {STEALTH_UNLOCK_LEVEL} to preview, or enable Dev unlock previews.</div>
                )}
              </div>
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

        {/* Deep Space controls */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="font-medium mb-2">Deep Space (unlock at Commander L{DEEP_UNLOCK_LEVEL})</h2>
          <p className="text-sm text-gray-500 mb-4">Use real endpoints to purchase and set default. Requires login.</p>

          <div className="space-y-2 text-sm">
            <div>Commander level: {commanderLevel ?? '…'}</div>
            <div>Unlocked: {unlockedDeep ? 'yes' : 'no'}</div>
            <div>Purchased: {purchasedDeep == null ? '…' : purchasedDeep ? 'yes' : 'no'}</div>
            <div>Default cover: {defaultCover ?? '(none)'}</div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={doPurchaseDeep}
              disabled={loading || !!purchasedDeep}
              className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {purchasedDeep ? 'Purchased' : 'Force Purchase (dev)'}
            </button>
            <button
              type="button"
              onClick={setDefaultDeep}
              disabled={loading || !purchasedDeep || defaultCover === DEEP_ID}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {defaultCover === DEEP_ID ? 'Default set' : 'Set as default'}
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
              onClick={resetDevDeep}
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
            {(unlockedDeep || devUnlockPreview) ? (
              <DeckCoverDeepSpace className="w-full" />
            ) : (
              <div className="w-full h-28 rounded-md bg-slate-100" aria-hidden />
            )}
            {!unlockedDeep && !devUnlockPreview && (
              <div className="mt-3 text-sm text-amber-600">Locked — reach Commander Level {DEEP_UNLOCK_LEVEL} to preview, or enable Dev unlock previews.</div>
            )}
          </div>
        </div>

        {/* Night Mission controls */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="font-medium mb-2">Night Mission (unlock at Commander L{NIGHT_UNLOCK_LEVEL})</h2>
          <p className="text-sm text-gray-500 mb-4">Use real endpoints to purchase and set default. Requires login.</p>

          <div className="space-y-2 text-sm">
            <div>Commander level: {commanderLevel ?? '…'}</div>
            <div>Unlocked: {unlockedNight ? 'yes' : 'no'}</div>
            <div>Purchased: {purchasedNight == null ? '…' : purchasedNight ? 'yes' : 'no'}</div>
            <div>Default cover: {defaultCover ?? '(none)'}</div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={doPurchaseNight}
              disabled={loading || !!purchasedNight}
              className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {purchasedNight ? 'Purchased' : 'Force Purchase (dev)'}
            </button>
            <button
              type="button"
              onClick={setDefaultNight}
              disabled={loading || !purchasedNight || defaultCover === NIGHT_ID}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {defaultCover === NIGHT_ID ? 'Default set' : 'Set as default'}
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
              onClick={resetDevNight}
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
            {(unlockedNight || devUnlockPreview) ? (
              <DeckCoverNightMission className="w-full" />
            ) : (
              <div className="w-full h-28 rounded-md bg-slate-100" aria-hidden />
            )}
            {!unlockedNight && !devUnlockPreview && (
              <div className="mt-3 text-sm text-amber-600">Locked — reach Commander Level {NIGHT_UNLOCK_LEVEL} to preview, or enable Dev unlock previews.</div>
            )}
          </div>
        </div>

        {/* Rainforest controls */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="font-medium mb-2">Rainforest (unlock at Commander L{RAINFOREST_UNLOCK_LEVEL})</h2>
          <p className="text-sm text-gray-500 mb-4">Use real endpoints to purchase and set default. Requires login.</p>

          <div className="space-y-2 text-sm">
            <div>Commander level: {commanderLevel ?? '…'}</div>
            <div>Unlocked: {unlockedRainforest ? 'yes' : 'no'}</div>
            <div>Purchased: {purchasedRainforest == null ? '…' : purchasedRainforest ? 'yes' : 'no'}</div>
            <div>Default cover: {defaultCover ?? '(none)'} </div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={doPurchaseRainforest}
              disabled={loading || !!purchasedRainforest}
              className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {purchasedRainforest ? 'Purchased' : 'Force Purchase (dev)'}
            </button>
            <button
              type="button"
              onClick={setDefaultRainforest}
              disabled={loading || !purchasedRainforest || defaultCover === RAINFOREST_ID}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {defaultCover === RAINFOREST_ID ? 'Default set' : 'Set as default'}
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
              onClick={resetDevRainforest}
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
            {(unlockedRainforest || devUnlockPreview) ? (
              <DeckCoverRainforest className="w-full" />
            ) : (
              <div className="w-full h-28 rounded-md bg-slate-100" aria-hidden />
            )}
            {!unlockedRainforest && !devUnlockPreview && (
              <div className="mt-3 text-sm text-amber-600">Locked — reach Commander Level {RAINFOREST_UNLOCK_LEVEL} to preview, or enable Dev unlock previews.</div>
            )}
          </div>
        </div>

        {/* Desert Storm controls */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="font-medium mb-2">Desert Storm (unlock at Commander L{DESERT_STORM_UNLOCK_LEVEL})</h2>
          <p className="text-sm text-gray-500 mb-4">Use real endpoints to purchase and set default. Requires login.</p>

          <div className="space-y-2 text-sm">
            <div>Commander level: {commanderLevel ?? '…'}</div>
            <div>Unlocked: {unlockedDesertStorm ? 'yes' : 'no'}</div>
            <div>Purchased: {purchasedDesertStorm == null ? '…' : purchasedDesertStorm ? 'yes' : 'no'}</div>
            <div>Default cover: {defaultCover ?? '(none)'} </div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={doPurchaseDesertStorm}
              disabled={loading || !!purchasedDesertStorm}
              className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {purchasedDesertStorm ? 'Purchased' : 'Force Purchase (dev)'}
            </button>
            <button
              type="button"
              onClick={setDefaultDesertStorm}
              disabled={loading || !purchasedDesertStorm || defaultCover === DESERT_STORM_ID}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {defaultCover === DESERT_STORM_ID ? 'Default set' : 'Set as default'}
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
              onClick={resetDevDesertStorm}
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
            {(unlockedDesertStorm || devUnlockPreview) ? (
              <DeckCoverDesertStorm className="w-full" />
            ) : (
              <div className="w-full h-28 rounded-md bg-slate-100" aria-hidden />
            )}
            {!unlockedDesertStorm && !devUnlockPreview && (
              <div className="mt-3 text-sm text-amber-600">Locked — reach Commander Level {DESERT_STORM_UNLOCK_LEVEL} to preview, or enable Dev unlock previews.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
