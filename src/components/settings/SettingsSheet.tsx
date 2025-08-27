"use client";
import React from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";
import { SunriseCover } from '@/components/DeckCovers';
import { supabaseRepo } from '@/lib/repo/supabaseRepo';

export default function SettingsSheet() {
  const [avatarFrame, setAvatarFrame] = React.useState<string>("unlock");
  const [value, setValue] = React.useState<string>("");
  const [sunrisePurchased, setSunrisePurchased] = React.useState<boolean>(false);
  // loading state intentionally omitted for brevity

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const def = await supabaseRepo.getUserDefaultCover();
        const purchased = await supabaseRepo.hasPurchasedCover("Sunrise");
        if (!mounted) return;
        // use sentinel for system default because SelectItem requires non-empty value
        setValue(def ?? '__system_default');
        setSunrisePurchased(!!purchased);
      } catch {
        /* ignore */
      }
    })();
    return () => { mounted = false; };
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
                <Select value={avatarFrame} onValueChange={setAvatarFrame}>
                  <SelectTrigger id="avatar-frame" className="w-full">
                    <SelectValue placeholder="Choose a frame" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlock" disabled>
                      Unlock more avatar frames
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Frames unlock with Commander Level and can be purchased in the Token Shop later.
                </p>
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
                            {/* Sunrise only enabled if purchased */}
                            {sunrisePurchased ? (
                              <SelectItem value="Sunrise">Sunrise</SelectItem>
                            ) : (
                              <SelectItem value="Sunrise" disabled>Sunrise (locked)</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <div className="mt-2">
                          {value === 'Sunrise' ? (
                            <div className="w-72"><SunriseCover /></div>
                          ) : null}
                        </div>
                    <p className="text-xs text-slate-500">Covers unlock with Commander Level and may be purchased in the Token Shop.</p>
                  </div>
                </section>

            {/* Future settings sections go here */}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
