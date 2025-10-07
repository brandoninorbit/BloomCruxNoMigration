"use client";
import React from "react";
import { getSupabaseClient } from '@/lib/supabase/browserClient';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings as SettingsIcon, Volume2, VolumeX, ChevronDown, Upload, X } from "lucide-react";
import { getAudioPrefs, saveAudioPrefs } from "@/lib/audio";
import { SunriseCover, DeckCoverDeepSpace, DeckCoverNightMission, DeckCoverAgentStealth, DeckCoverRainforest, DeckCoverDesertStorm } from '@/components/DeckCovers';
import { AvatarFrameNeonGlow } from '@/components/AvatarFrames';
import { supabaseRepo } from '@/lib/repo/supabaseRepo';
import { fetchWithAuth } from '@/lib/supabase/fetchWithAuth';
import { UNLOCKS } from '@/lib/unlocks';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/app/providers/AuthProvider";

export default function SettingsSheet() {
  const { user } = useAuth();
  // Track auth state; start unknown so we can delay rendering until known
  const [signedIn, setSignedIn] = React.useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  
  // Collapsible section states
  const [appearanceOpen, setAppearanceOpen] = React.useState(true);
  const [accessibilityOpen, setAccessibilityOpen] = React.useState(false);

  // Custom avatar
  const [customAvatarUrl, setCustomAvatarUrl] = React.useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        setSignedIn(!!data?.user);
      } catch {
        if (!active) return;
        setSignedIn(false);
      } finally {
        if (active) setAuthChecked(true);
      }
    })();
    return () => { active = false; };
  }, []);
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
        const customAvatar = await supabaseRepo.getCustomAvatarUrl();
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
        setCustomAvatarUrl(customAvatar);
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setAvatarUploading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');

      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentUser.id}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = data.publicUrl;

      // Save to user_settings
      await supabaseRepo.setCustomAvatarUrl(avatarUrl);
      setCustomAvatarUrl(avatarUrl);

      // Notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profile:avatar-updated', { detail: { avatarUrl } }));
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await supabaseRepo.setCustomAvatarUrl(null);
      setCustomAvatarUrl(null);
      
      // Notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profile:avatar-updated', { detail: { avatarUrl: null } }));
      }
    } catch (error) {
      console.error('Error deleting avatar:', error);
      alert('Failed to delete avatar');
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

  // Only render sheet trigger if user is signed in; otherwise render nothing
  if (authChecked && !signedIn) return null;
  if (!authChecked) return null;
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
    <SheetContent side="right" className="w-full sm:max-w-full p-0 bg-white rounded-[25px] mt-2">
        <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b bg-white px-6 py-4 rounded-t-[25px]">
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
              <SheetDescription>Manage your BloomCrux preferences.</SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Appearance Section - Collapsible */}
            <Collapsible open={appearanceOpen} onOpenChange={setAppearanceOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Appearance</h2>
                  <p className="text-sm text-slate-500">Personalize how your profile looks</p>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${appearanceOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Separator className="my-4" />
                
                {/* Profile Picture Upload */}
                <div className="mb-6">
                  <Label className="text-sm font-medium">Profile Picture</Label>
                  <p className="text-xs text-slate-500 mb-3">Upload a custom profile picture to override your email provider photo</p>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={customAvatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || undefined} />
                      <AvatarFallback>{(user?.email?.[0] ?? 'U').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload className="h-4 w-4" />
                        {avatarUploading ? 'Uploading...' : 'Upload Photo'}
                      </button>
                      {customAvatarUrl && (
                        <button
                          type="button"
                          onClick={handleDeleteAvatar}
                          className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                        >
                          <X className="h-4 w-4" />
                          Remove Custom Photo
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Maximum file size: 5MB. Supported formats: JPG, PNG, GIF</p>
                </div>

                {/* Avatar Frames */}
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
                  <p className="text-xs text-slate-500">
                    Frames unlock with Commander Level and can be purchased in the Token Shop later.
                  </p>
                  </div>
                </div>

                {/* Deck Covers */}
                <Separator className="my-6" />
                <div className="grid gap-2 max-w-md">
                  <Label htmlFor="deck-cover" className="text-sm font-medium">Default Deck Cover</Label>
                  <p className="text-xs text-slate-500 mb-2">Choose a default cover applied to your decks</p>
                  <Select value={value ?? ''} onValueChange={onChangeDefault}>
                    <SelectTrigger id="deck-cover" className="w-full">
                      <SelectValue placeholder="System default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__system_default">System default</SelectItem>
                      {shouldShowCosmetic('Sunrise', sunrisePurchased) && (
                        sunrisePurchased ? (
                          <SelectItem value="Sunrise">Sunrise</SelectItem>
                        ) : (
                          <SelectItem value="Sunrise" disabled>Sunrise (locked)</SelectItem>
                        )
                      )}
                      {shouldShowCosmetic('DeepSpace', deepPurchased) && (
                        deepPurchased ? (
                          <SelectItem value="DeepSpace">Deep Space</SelectItem>
                        ) : (
                          <SelectItem value="DeepSpace" disabled>Deep Space (locked)</SelectItem>
                        )
                      )}
                      {shouldShowCosmetic('NightMission', nightPurchased) && (
                        nightPurchased ? (
                          <SelectItem value="NightMission">Night Mission</SelectItem>
                        ) : (
                          <SelectItem value="NightMission" disabled>Night Mission (locked)</SelectItem>
                        )
                      )}
                      {shouldShowCosmetic('AgentStealth', stealthPurchased) && (
                        stealthPurchased ? (
                          <SelectItem value="AgentStealth">Agent Stealth</SelectItem>
                        ) : (
                          <SelectItem value="AgentStealth" disabled>Agent Stealth (locked)</SelectItem>
                        )
                      )}
                      {shouldShowCosmetic('Rainforest', rainPurchased) && (
                        rainPurchased ? (
                          <SelectItem value="Rainforest">Rainforest</SelectItem>
                        ) : (
                          <SelectItem value="Rainforest" disabled>Rainforest (locked)</SelectItem>
                        )
                      )}
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
              </CollapsibleContent>
            </Collapsible>

            {/* Accessibility Section - Collapsible (Audio moved here) */}
            <Collapsible open={accessibilityOpen} onOpenChange={setAccessibilityOpen} className="mt-6 mb-10">
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Accessibility</h2>
                  <p className="text-sm text-slate-500">Audio feedback and sound settings</p>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${accessibilityOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
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
                      <button type="button" className="text-xs px-2 py-1 rounded border hover:bg-slate-50" onClick={() => { const a = new Audio('/audio/correct-356013.mp3'); a.volume = audioMuted ? 0 : audioCorrect*audioGlobal; a.play().catch(()=>{}); }}>Test</button>
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
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
