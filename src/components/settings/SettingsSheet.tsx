"use client";
import React from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsSheet() {
  const [value, setValue] = React.useState<string>("unlock");
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
                <Select value={value} onValueChange={setValue}>
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

            {/* Future settings sections go here */}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
