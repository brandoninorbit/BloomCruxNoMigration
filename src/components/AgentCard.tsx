'use client';


import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Coins, Trophy, Star, Shield } from 'lucide-react';

export type AgentCardProps = {
  displayName: string;
  level: number;
  tokens: number;
  avatarUrl?: string | null;
  nextUnlockLabel?: string;   // e.g. "Lvl 10"
  nextUnlockName?: string;    // e.g. "Animated Avatar Frames"
  className?: string;
};

export default function AgentCard({
  displayName,
  level,
  tokens,
  avatarUrl,
  nextUnlockLabel = 'Lvl 10',
  nextUnlockName = 'Animated Avatar Frames',
  className,
}: AgentCardProps) {
  return (
    <Card
      className={cn(
        // rectangular, airy, white card
        'min-h-[28rem] rounded-2xl bg-card shadow-sm',
        className
      )}
    >
      <CardHeader className="items-center">
        {/* Avatar placeholder like the studio shot */}

        <div className="relative mb-3 h-24 w-24 overflow-hidden rounded-full bg-muted">
          <Image
            src={avatarUrl || 'https://placehold.co/100x100.png'}
            alt={`${displayName} avatar`}
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>

        <CardTitle className="text-center text-2xl font-semibold">{displayName}</CardTitle>
        <CardDescription className="text-center">Commander Level {level}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Tokens row */}
        <div className="flex items-center justify-center gap-2 text-lg">
          <Coins className="h-5 w-5 text-yellow-500" />
          <span className="font-semibold">{tokens}</span>
        </div>

        {/* top divider */}
        <div className="mx-auto h-px w-full max-w-[85%] bg-border" />

        {/* Badges */}
        <div className="space-y-3">
          <div className="text-center font-medium text-muted-foreground">Badges Unlocked</div>
          <div className="flex items-center justify-center gap-3">
            {/* each badge sits in a light gray pill and grows slightly on hover */}
            <div className="group grid h-9 w-9 place-items-center rounded-full bg-muted transition-transform hover:scale-110">
              <Trophy className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="group grid h-9 w-9 place-items-center rounded-full bg-muted transition-transform hover:scale-110">
              <Star className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="group grid h-9 w-9 place-items-center rounded-full bg-muted transition-transform hover:scale-110">
              <Star className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* bottom divider */}
        <div className="mx-auto h-px w-full max-w-[85%] bg-border" />

        {/* Next Unlock */}
        <div className="space-y-3">
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Next Unlock - </span>
            <span className="font-semibold text-primary">{nextUnlockLabel}</span>
          </div>

          {/* big blue gradient round button */}
          <div className="flex justify-center">
            <button
              type="button"
              className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md transition-transform hover:scale-105"
              title={nextUnlockName}
            >
              <Shield className="h-7 w-7" />
            </button>
          </div>

          <div className="text-center text-xs text-muted-foreground">{nextUnlockName}</div>
        </div>
      </CardContent>
    </Card>
  );
}
