"use client";
import React from "react";
import { getSupabaseClient } from '@/lib/supabase/browserClient';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Volume2, VolumeX } from "lucide-react";
import { getAudioPrefs, saveAudioPrefs } from "@/lib/audio";
import { SunriseCover, DeckCoverDeepSpace, DeckCoverNightMission, DeckCoverAgentStealth, DeckCoverRainforest, DeckCoverDesertStorm } from '@/components/DeckCovers';
import { AvatarFrameNeonGlow } from '@/components/AvatarFrames';
import { supabaseRepo } from '@/lib/repo/supabaseRepo';
import { fetchWithAuth } from '@/lib/supabase/fetchWithAuth';
import { UNLOCKS } from '@/lib/unlocks';

export default function SettingsSheet() {
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        setSignedIn(!!data?.user);
      } catch { setSignedIn(false); }
    })();
    return () => { active = false; };
  }, []);
  if (signedIn === false) return null; // hide entirely when signed out
  const [avatarFrame, setAvatarFrame] = React.useState<string>("unlock");
  const [neonPurchased, setNeonPurchased] = React.useState<boolean>(false);
  const [value, setValue] = React.useState<string>("");
  const [sunrisePurchased, setSunrisePurchased] = React.useState<boolean>(false);
  const [deepPurchased, setDeepPurchased] = React.useState<boolean>(false);
  const [nightPurchased, setNightPurchased] = React.useState<boolean>(false);
  const [stealthPurchased, setStealthPurchased] = React.useState<boolean>(false);
  const [rainPurchased, setRainPurchased] = React.useState<boolean>(false);
  const [desertPurchased, setDesertPurchased] = React.useState<boolean>(false);
  const [commanderLevel, setCommanderLevel] = React.useState<number>(0);
  // Audio prefs
  const [audioGlobal, setAudioGlobal] = React.useState(1);
  const [audioCorrect, setAudioCorrect] = React.useState(1);
  const [audioLevelUp, setAudioLevelUp] = React.useState(1);
  const [audioMuted, setAudioMuted] = React.useState(false);
  // loading state intentionally omitted for brevity

  React.useEffect(() => {
    let mounted = true;

    const checkNeonPurchased = async () => {
      try {
        const neonApi = await fetchWithAuth('/api/covers/purchased?coverId=NeonGlow', { cache: 'no-store' });
        if (neonApi.ok) {
          const j = await neonApi.json();
          setNeonPurchased(!!j?.purchased);
          return;
        }
      } catch {
        // ignore
      }
      // fallback to client repo check
      try {
        const neon = await supabaseRepo.hasPurchasedCover('NeonGlow');
        setNeonPurchased(!!neon);
      } catch {}
    };

  (async () => {
      try {
        const def = await supabaseRepo.getUserDefaultCover();
        const avatarDef = await supabaseRepo.getUserDefaultAvatarFrame();
        const purchased = await supabaseRepo.hasPurchasedCover('Sunrise');
        const purchasedDeep = await supabaseRepo.hasPurchasedCover('DeepSpace');
        const purchasedNight = await supabaseRepo.hasPurchasedCover('NightMission');
        const purchasedStealth = await supabaseRepo.hasPurchasedCover('AgentStealth');
        const purchasedRain = await supabaseRepo.hasPurchasedCover('Rainforest');
        const purchasedDesert = await supabaseRepo.hasPurchasedCover('DesertStorm');

        // Fetch commander level
        const walletRes = await fetchWithAuth('/api/economy/wallet', { cache: 'no-store' });
        let level = 0;
        if (walletRes.ok) {
          const walletData = await walletRes.json();
          level = Number(walletData?.commander_level ?? 0);
        }

        if (!mounted) return;
        setValue(def ?? '__system_default');
        setAvatarFrame(avatarDef ?? '__system_default');
        setSunrisePurchased(!!purchased);
        setDeepPurchased(!!purchasedDeep);
        setNightPurchased(!!purchasedNight);
        setStealthPurchased(!!purchasedStealth);
        setRainPurchased(!!purchasedRain);
        setDesertPurchased(!!purchasedDesert);
        setCommanderLevel(Number.isFinite(level) ? level : 0);
      } catch {
        /* ignore */
      }
      // Always re-check neon purchased via API
  await checkNeonPurchased();
  // Load audio prefs
  const prefs = getAudioPrefs();
  setAudioGlobal(prefs.globalVolume);
  setAudioCorrect(prefs.correctVolume);
  setAudioLevelUp(prefs.levelupVolume);
  setAudioMuted(prefs.muted);
    })();

    const onFocus = () => { checkNeonPurchased().catch(() => {}); };
    const onPurchasedEvent = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (detail?.coverId === 'NeonGlow') setNeonPurchased(true);
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('cover:purchased', onPurchasedEvent as EventListener);

    return () => { mounted = false; window.removeEventListener('focus', onFocus); window.removeEventListener('cover:purchased', onPurchasedEvent as EventListener); };
  }, []);

    const onChangeDefault = async (v: string) => {
      setValue(v);
      try {
        const coverId = v === '__system_default' ? null : v;
        await supabaseRepo.setUserDefaultCover(coverId);
        // Notify other views (e.g., Decks page) to reload cover visuals immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('deck-covers:default-updated', { detail: { coverId } }));
        }
      } catch {
        // swallow for now
      }
    };

  const onChangeAvatarDefault = async (v: string) => {
    setAvatarFrame(v);
    try {
      const frameId = v === '__system_default' ? null : v;
      await supabaseRepo.setUserDefaultAvatarFrame(frameId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('avatar-frames:default-updated', { detail: { frameId } }));
      }
    } catch {
      // ignore
    }
  };

  // Helper function to determine if a cosmetic should be shown in dropdown
  const shouldShowCosmetic = (cosmeticId: string, isPurchased: boolean): boolean => {
    if (isPurchased) return true; // Always show if purchased
    
    // Check if it's the next unlock
    const unlock = UNLOCKS.find(u => u.id === cosmeticId);
    if (!unlock) return false;
    
    return unlock.level === (commanderLevel + 1);
  };

  // Optionally delay render until auth checked to avoid flicker
  if (signedIn === null) return null;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open settings"
          className="rounded-full p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </SheetTrigger>
    <SheetContent side="right" className="w-full sm:max-w-full p-0 bg-white">
        <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b bg-white px-6 py-4">
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
              <SheetDescription>Manage your BloomCrux preferences.</SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <section className="mb-8">
              <h2 className="text-base font-semibold text-slate-800">Appearance</h2>
              <p className="text-sm text-slate-500">Personalize how your profile looks across the app.</p>
              <Separator className="my-4" />

              <div className="grid gap-2 max-w-md">
                <Label htmlFor="avatar-frame">Animated avatar frames</Label>
                <Select value={avatarFrame} onValueChange={onChangeAvatarDefault}>
                  <SelectTrigger id="avatar-frame" className="w-full">
                    <SelectValue placeholder="Choose a frame" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__system_default">System default</SelectItem>
                    {shouldShowCosmetic('NeonGlow', neonPurchased) && (
                      neonPurchased ? (
                        <SelectItem value="NeonGlow">Neon Glow</SelectItem>
                      ) : (
                        <SelectItem value="NeonGlow" disabled>Neon Glow (locked)</SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <div className="mt-2">
                  {avatarFrame === 'NeonGlow' ? (
                    <div className="w-24"><AvatarFrameNeonGlow sizeClass="w-24 h-24" /></div>
                  ) : null}
                  <div className="text-xs text-slate-400 mt-2">Debug: neonPurchased = {String(neonPurchased)}</div>
                <p className="text-xs text-slate-500">
                  Frames unlock with Commander Level and can be purchased in the Token Shop later.
                </p>
                </div>
              </div>
            </section>

                <section className="mb-8">
                  <h2 className="text-base font-semibold text-slate-800">Deck Covers</h2>
                  <p className="text-sm text-slate-500">Choose a default deck cover applied to new and existing decks.</p>
                  <Separator className="my-4" />
                  <div className="grid gap-2 max-w-md">
                        <Label htmlFor="deck-cover">Default Deck Cover</Label>
                        <Select value={value ?? ''} onValueChange={onChangeDefault}>
                          <SelectTrigger id="deck-cover" className="w-full">
                            <SelectValue placeholder="System default" />
                          </SelectTrigger>
              <SelectContent>
                <SelectItem value="__system_default">System default</SelectItem>
                            {/* Sunrise only enabled if purchased or next unlock */}
                            {shouldShowCosmetic('Sunrise', sunrisePurchased) && (
                              sunrisePurchased ? (
                                <SelectItem value="Sunrise">Sunrise</SelectItem>
                              ) : (
                                <SelectItem value="Sunrise" disabled>Sunrise (locked)</SelectItem>
                              )
                            )}
                            {/* Deep Space only enabled if purchased or next unlock */}
                            {shouldShowCosmetic('DeepSpace', deepPurchased) && (
                              deepPurchased ? (
                                <SelectItem value="DeepSpace">Deep Space</SelectItem>
                              ) : (
                                <SelectItem value="DeepSpace" disabled>Deep Space (locked)</SelectItem>
                              )
                            )}
                            {/* Night Mission only enabled if purchased or next unlock */}
                            {shouldShowCosmetic('NightMission', nightPurchased) && (
                              nightPurchased ? (
                                <SelectItem value="NightMission">Night Mission</SelectItem>
                              ) : (
                                <SelectItem value="NightMission" disabled>Night Mission (locked)</SelectItem>
                              )
                            )}
                            {/* Agent Stealth only enabled if purchased or next unlock */}
                            {shouldShowCosmetic('AgentStealth', stealthPurchased) && (
                              stealthPurchased ? (
                                <SelectItem value="AgentStealth">Agent Stealth</SelectItem>
                              ) : (
                                <SelectItem value="AgentStealth" disabled>Agent Stealth (locked)</SelectItem>
                              )
                            )}
                            {/* Rainforest only enabled if purchased or next unlock */}
                            {shouldShowCosmetic('Rainforest', rainPurchased) && (
                              rainPurchased ? (
                                <SelectItem value="Rainforest">Rainforest</SelectItem>
                              ) : (
                                <SelectItem value="Rainforest" disabled>Rainforest (locked)</SelectItem>
                              )
                            )}
                            {/* Desert Storm only enabled if purchased or next unlock */}
                            {shouldShowCosmetic('DesertStorm', desertPurchased) && (
                              desertPurchased ? (
                                <SelectItem value="DesertStorm">Desert Storm</SelectItem>
                              ) : (
                                <SelectItem value="DesertStorm" disabled>Desert Storm (locked)</SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <div className="mt-2">
                          {value === 'Sunrise' ? (
                            <div className="w-72"><SunriseCover /></div>
              ) : value === 'DeepSpace' ? (
                <div className="w-72"><DeckCoverDeepSpace /></div>
              ) : value === 'NightMission' ? (
                <div className="w-72"><DeckCoverNightMission /></div>
              ) : value === 'AgentStealth' ? (
                <div className="w-72"><DeckCoverAgentStealth /></div>
              ) : value === 'Rainforest' ? (
                <div className="w-72"><DeckCoverRainforest /></div>
              ) : value === 'DesertStorm' ? (
                <div className="w-72"><DeckCoverDesertStorm /></div>
              ) : null}
                        </div>
                    <p className="text-xs text-slate-500">Covers unlock with Commander Level and may be purchased in the Token Shop.</p>
                  </div>
                </section>

            <section className="mb-10">
              <h2 className="text-base font-semibold text-slate-800">Audio</h2>
              <p className="text-sm text-slate-500">Set feedback & level-up sound levels.</p>
              <Separator className="my-4" />
              <div className="space-y-6 max-w-md">
                {/* Global Volume */}
                <div>
                  <Label htmlFor="audio-global" className="flex items-center justify-between">Global Volume
                    <button type="button" aria-label={audioMuted ? 'Unmute' : 'Mute'} onClick={() => { const next = !audioMuted; setAudioMuted(next); saveAudioPrefs({ muted: next }); }} className="ml-4 rounded p-2 border hover:bg-slate-50">
                      {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </Label>
                  <div className="flex items-center gap-3 mt-2">
                    <input id="audio-global" type="range" min={0} max={100} value={Math.round(audioGlobal*100)} onChange={(e) => { const v = Number(e.target.value)/100; setAudioGlobal(v); saveAudioPrefs({ globalVolume: v }); }} className="flex-1" />
                    <span className="w-10 text-right text-xs tabular-nums">{Math.round(audioGlobal*100)}%</span>
                  </div>
                </div>
                {/* Correct Answer Volume */}
                <div>
                  <Label htmlFor="audio-correct" className="flex items-center justify-between">Correct Answer</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <input id="audio-correct" type="range" min={0} max={100} value={Math.round(audioCorrect*100)} onChange={(e) => { const v = Number(e.target.value)/100; setAudioCorrect(v); saveAudioPrefs({ correctVolume: v }); }} className="flex-1" />
                    <button type="button" className="text-xs px-2 py-1 rounded border hover:bg-slate-50" onClick={() => { // test sound
                      const a = new Audio('/audio/correct-356013.mp3'); a.volume = audioMuted ? 0 : audioCorrect*audioGlobal; a.play().catch(()=>{});
                    }}>Test</button>
                    <span className="w-10 text-right text-xs tabular-nums">{Math.round(audioCorrect*100)}%</span>
                  </div>
                </div>
                {/* Level Up Volume */}
                <div>
                  <Label htmlFor="audio-levelup" className="flex items-center justify-between">Level Up</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <input id="audio-levelup" type="range" min={0} max={100} value={Math.round(audioLevelUp*100)} onChange={(e) => { const v = Number(e.target.value)/100; setAudioLevelUp(v); saveAudioPrefs({ levelupVolume: v }); }} className="flex-1" />
                    <button type="button" className="text-xs px-2 py-1 rounded border hover:bg-slate-50" onClick={() => { const a = new Audio('/audio/level-up-47165.mp3'); a.volume = audioMuted ? 0 : audioLevelUp*audioGlobal; a.play().catch(()=>{}); }}>Test</button>
                    <span className="w-10 text-right text-xs tabular-nums">{Math.round(audioLevelUp*100)}%</span>
                  </div>
                </div>
              </div>
            </section>
            {/* Future settings sections go here */}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
