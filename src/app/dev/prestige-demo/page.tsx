"use client";

import React from "react";

const BLOOM_LEVELS = ["Remember","Understand","Apply","Analyze","Evaluate","Create"] as const;

export default function PrestigeDemo(){
  const samples = [80,85,90,94,100];
  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold">Prestige sparkle demo</h2>
      <p className="text-sm text-gray-600">Rows show level + different mastery fills (sparkles only appear from 80% to the fill).</p>
      <div className="space-y-6 mt-4">
        {BLOOM_LEVELS.map((lvl)=> (
          <div key={lvl} className="space-y-2">
            <div className="text-sm font-medium">{lvl}</div>
            <div className="space-y-2">
              {samples.map((s)=> (
                <div key={s} className="w-full">
                  <div
                    className="relative w-full bloom-prestige-wrapper"
                    data-bloom-level={lvl}
                    style={{
                      // Inline CSS custom properties typed as CSSProperties
                      // Using index signature to set CSS variables without `any`.
                      // TS: cast to unknown first to satisfy strict typings safely.
                      ...( { ['--prestige-fill']: `${Math.min(100, Math.max(80, s + 3))}%`, ['--gap-x']: lvl === 'Remember' ? '40px' : lvl === 'Understand' ? '36px' : lvl === 'Apply' ? '32px' : lvl === 'Analyze' ? '28px' : lvl === 'Evaluate' ? '24px' : '20px' } as unknown as React.CSSProperties ),
                    }}
                  >
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
                      <div className="h-3 rounded-full" style={{width: '80%', background: 'linear-gradient(90deg,#3B8CE0,#60A9FF)'}} />
                      <div className={`h-3 rounded-full absolute top-0 overflow-hidden`} data-bloom-level={lvl} style={{left: '80%', width: `${Math.min(s - 80,20)}%`, background: 'linear-gradient(90deg,#60A9FF,#9BD0FF)'}} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
