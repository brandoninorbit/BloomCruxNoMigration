'use client';
import React, { useEffect, useState } from 'react';

import Image from 'next/image';
import { getNextUnlockForLevel } from '@/lib/unlocks';

// Lightweight Card primitives and utils
function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(' ');
}
function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('rounded-2xl border bg-white shadow-sm', props.className)} />;
}
function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...props} className={cn('text-xl font-semibold', props.className)} />;
}
function CardDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn('text-sm text-muted-foreground', props.className)} />;
}

// Fallback Icons
// Simple token-shaped SVG to replace coin imagery
const TokenIcon = () => (
  <svg
    aria-label="tokens"
    role="img"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="tokenGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
    </defs>
    {/* hex token */}
    <path
      d="M12 2l7 4v8l-7 4-7-4V6l7-4z"
      fill="url(#tokenGrad)"
    />
    {/* subtle inner symbol */}
    <path
      d="M12 7.5l3.5 2V14l-3.5 2-3.5-2V9.5l3.5-2z"
      fill="#fff"
      opacity="0.25"
    />
  </svg>
);
const Trophy = () => <span role="img" aria-label="trophy">🏆</span>;
const Star = () => <span role="img" aria-label="star">⭐</span>;

const AVATAR_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" rx="50" fill="%23e5e7eb"/></svg>';

export type AgentCardProps = {
  displayName: string;
  level: number;
  tokens: number;
  avatarUrl?: string | null;
  className?: string;
};

export default function AgentCard({
  displayName,
  level,
  tokens,
  avatarUrl,
  className,
}: AgentCardProps) {
  // Centralized next unlock
  const next = getNextUnlockForLevel(level);

  // Enforce a 5:7 (width:height) ratio exactly (width:height = 5:7 => h = w * 7/5 = 1.4w)
  const RATIO = 7 / 5; // height / width
  const BASE_W = 300; // base width reference (tweakable)
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const calc = () => {
      if (typeof window === 'undefined') return;
      const s = Math.min(1, window.innerWidth / 1920);
      setScale(Number(s.toFixed(4)));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // Maintain original aspect ratio strictly. Width scales with viewport, height derives.
  const w = Math.max(200, BASE_W * scale);
  const h = Math.round(w * RATIO);

  return (
    <Card
  style={{ width: w, height: h, aspectRatio: '5 / 7' }}
      className={cn(
        'transition will-change-transform bg-white relative overflow-hidden',
        'hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl',
        className
      )}
    >
      {/* NEW: 
        - Removed overflow-y-auto
        - Removed space-y-*
        - Added justify-around for dynamic vertical spacing
      */}
      <div className="absolute inset-0 flex flex-col items-center justify-around p-4 text-center">
        
        {/* Header Section */}
        <div>
          <div className="relative mx-auto mb-2 h-16 w-16 overflow-hidden rounded-full bg-gray-200">
            <Image
              src={avatarUrl || AVATAR_PLACEHOLDER}
              alt={`${displayName || 'Agent'} avatar`}
              width={100}
              height={100}
              className="object-cover h-full w-full"
              unoptimized
              priority
            />
          </div>
          <CardTitle>{displayName}</CardTitle>
          <CardDescription>Commander Level {level}</CardDescription>
        </div>

        {/* Tokens */}
        <div className="flex items-center justify-center gap-2 text-lg">
          <span className="h-5 w-5 text-blue-500"><TokenIcon /></span>
          <span className="font-semibold">{tokens}</span>
        </div>

        {/* Badges Section */}
        <div className="space-y-2">
          <div className="font-medium text-muted-foreground text-sm">Badges Unlocked</div>
          <div className="flex items-center justify-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gray-200">
              <span className="h-5 w-5 text-yellow-500"><Trophy /></span>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gray-200">
              <span className="h-5 w-5 text-gray-400"><Star /></span>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gray-200">
              <span className="h-5 w-5 text-gray-400"><Star /></span>
            </div>
          </div>
        </div>

        {/* Next Unlock Section (text-only, no icon) */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Next unlock</div>
      {next ? (
            <div className="text-sm">
        <span className="font-semibold">Lvl {next.level}</span>
              <span className="mx-1">—</span>
        <span className="text-muted-foreground">{next.name}</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No upcoming unlocks</div>
          )}
        </div>
      </div>
    </Card>
  );
}