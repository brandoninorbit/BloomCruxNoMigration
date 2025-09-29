// Simple client-side audio manager for study + level-up cues.
// Uses singleton HTMLAudioElements to avoid reloading files.

import { supabaseRepo } from '@/lib/repo/supabaseRepo';

const sounds: Record<string, HTMLAudioElement | null> = { correct: null, levelup: null };

function isHeadlessDom() {
  if (typeof window === 'undefined') return true; // SSR: treat as headless for playback
  const ua = (window.navigator && window.navigator.userAgent) || '';
  // jsdom user agent contains 'jsdom'
  return /jsdom/i.test(ua);
}

type AudioPrefs = {
  globalVolume: number; // 0..1
  correctVolume: number; // 0..1
  levelupVolume: number; // 0..1
  muted: boolean;
};

let cachedPrefs: AudioPrefs | null = null;
let lastFetchTs = 0;
let saveDebounce: ReturnType<typeof setTimeout> | null = null;

function defaults(): AudioPrefs { return { globalVolume: 1, correctVolume: 1, levelupVolume: 1, muted: false }; }

function loadPrefs(): AudioPrefs {
  if (cachedPrefs) return cachedPrefs;
  if (typeof window === 'undefined') { cachedPrefs = defaults(); return cachedPrefs; }
  try {
    const raw = localStorage.getItem('audio:prefs');
    if (!raw) { cachedPrefs = defaults(); return cachedPrefs; }
    const p = JSON.parse(raw);
    cachedPrefs = {
      globalVolume: clamp01(p.globalVolume ?? 1),
      correctVolume: clamp01(p.correctVolume ?? 1),
      levelupVolume: clamp01(p.levelupVolume ?? 1),
      muted: Boolean(p.muted),
    };
    return cachedPrefs;
  } catch { cachedPrefs = defaults(); return cachedPrefs; }
}

async function fetchRemotePrefsIfStale() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastFetchTs < 15000) return; // throttle fetch
  lastFetchTs = now;
  try {
    const remote = await supabaseRepo.getAudioPrefs();
    if (remote && typeof remote === 'object') {
      const base = loadPrefs();
      const merged: Partial<AudioPrefs> & Record<string, unknown> = { ...base, ...remote };
      const final: AudioPrefs = {
        globalVolume: clamp01(merged.globalVolume ?? 1),
        correctVolume: clamp01(merged.correctVolume ?? 1),
        levelupVolume: clamp01(merged.levelupVolume ?? 1),
        muted: Boolean(merged.muted),
      };
      cachedPrefs = final;
      localStorage.setItem('audio:prefs', JSON.stringify(final));
      // Apply live
      Object.entries(sounds).forEach(([id, el]) => {
        if (!el) return;
        const baseVol = id === 'correct' ? final.correctVolume : id === 'levelup' ? final.levelupVolume : 1;
        el.volume = final.muted ? 0 : clamp01(baseVol * final.globalVolume);
      });
    }
  } catch { /* ignore */ }
}

function clamp01(n: unknown) { const x = Number(n); return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 1; }

export function saveAudioPrefs(partial: Partial<AudioPrefs>) {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadPrefs();
    const next: AudioPrefs = { ...prev, ...partial };
    localStorage.setItem('audio:prefs', JSON.stringify(next));
    cachedPrefs = next;
    // Apply volumes immediately to live audio elements
    Object.entries(sounds).forEach(([id, el]) => {
      if (!el) return;
      const prefs = next;
      const baseVol = id === 'correct' ? prefs.correctVolume : id === 'levelup' ? prefs.levelupVolume : 1;
      el.volume = prefs.muted ? 0 : clamp01(baseVol * prefs.globalVolume);
    });
    // Debounced remote upsert
    if (saveDebounce) clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => {
      supabaseRepo.saveAudioPrefs({
        globalVolume: next.globalVolume,
        correctVolume: next.correctVolume,
        levelupVolume: next.levelupVolume,
        muted: next.muted,
      }).catch(() => {});
    }, 800);
  } catch {}
}

function ensure(id: keyof typeof sounds, src: string) {
  if (typeof window === 'undefined') return null;
  if (!sounds[id]) {
    const a = new Audio(src);
    a.preload = 'auto';
    sounds[id] = a;
  }
  // Always update volume from prefs when requested
  const prefs = loadPrefs();
  const baseVol = id === 'correct' ? prefs.correctVolume : id === 'levelup' ? prefs.levelupVolume : 1;
  const vol = prefs.muted ? 0 : clamp01(baseVol * prefs.globalVolume);
  const el = sounds[id];
  if (el) el.volume = vol;
  return sounds[id];
}

export function playCorrectSound(opts?: { defer?: boolean }) {
  if (opts?.defer) return; // caller will explicitly trigger later
  const a = ensure('correct', '/audio/correct-356013.mp3');
  try {
    if (a) {
      if (isHeadlessDom()) return; // skip playback in test/headless environments
      a.currentTime = 0;
      const r = a.play?.();
      if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => {});
    }
  } catch {}
}

export function triggerDeferredCorrect() {
  playCorrectSound();
}

export function playLevelUpSound() {
  const a = ensure('levelup', '/audio/level-up-47165.mp3');
  try {
    if (a) {
      if (isHeadlessDom()) return;
      a.currentTime = 0;
      const r = a.play?.();
      if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => {});
    }
  } catch {}
}

// Expose read helper for UI
export function getAudioPrefs(): AudioPrefs { return loadPrefs(); }

// Kick off initial remote sync + periodic refresh in browser
if (typeof window !== 'undefined') {
  setTimeout(() => { fetchRemotePrefsIfStale(); }, 1200);
  setInterval(() => { fetchRemotePrefsIfStale(); }, 120000); // 2 min
}
