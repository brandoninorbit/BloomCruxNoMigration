'use client';

import Image from 'next/image';
// Tiny inline SVG placeholder for avatar
const AVATAR_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" rx="50" fill="%23e5e7eb"/></svg>';
// Fallback emoji for icons if lucide-react is not present
const Coins = () => <span role="img" aria-label="coins">🪙</span>;
const Trophy = () => <span role="img" aria-label="trophy">🏆</span>;
const Star = () => <span role="img" aria-label="star">⭐</span>;
const Shield = () => <span role="img" aria-label="shield">🛡️</span>;

/** lightweight Card primitives (Tailwind only) */
function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(' ');
}
function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('rounded-2xl border bg-white shadow-sm', props.className)}
    />
  );
}
function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('p-6', props.className)} />;
}
function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...props} className={cn('text-2xl font-semibold', props.className)} />;
}
function CardDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn('text-sm text-muted-foreground', props.className)} />;
}
function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('p-6 pt-0 space-y-6', props.className)} />;
}

/** inline SVG so we don't need next/image or remote host config */

export type AgentCardProps = {
  displayName: string;
  level: number;
  tokens: number;
  avatarUrl?: string | null;
  nextUnlockLabel?: string;    // e.g. "Lvl 10"
  nextUnlockName?: string;     // e.g. "Animated Avatar Frames"
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
        'min-h-[28rem] lg:max-w-sm transition will-change-transform bg-white',
        'hover:-translate-y-1 hover:scale-[1.01] hover:shadow-2xl',
        className
      )}
    >
      {/* FIX: make header a flex column and center items */}
      <CardHeader className="flex flex-col items-center">
        {/* Avatar circle (Next/Image) */}
        <div className="relative mb-3 h-24 w-24 overflow-hidden rounded-full bg-gray-200">
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

        <CardTitle className="text-center">{displayName}</CardTitle>
        <CardDescription className="text-center">Commander Level {level}</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Tokens row */}
        <div className="flex items-center justify-center gap-2 text-lg">
          <span className="h-5 w-5 text-yellow-500"><Coins /></span>
          <span className="font-semibold">{tokens}</span>
        </div>

        {/* divider */}
        <div className="mx-6 my-2 border-t" />

        {/* Badges row: 1 gold trophy, 2 grey-star placeholders */}
        <div className="space-y-3">
          <div className="text-center font-medium text-muted-foreground">Badges Unlocked</div>
          <div className="flex items-center justify-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gray-200">
              <span className="h-5 w-5 text-yellow-500"><Trophy /></span>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gray-200">
              <span className="h-5 w-5 text-gray-400"><Star /></span>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gray-200">
              <span className="h-5 w-5 text-gray-400"><Star /></span>
            </div>
          </div>
        </div>

        {/* divider */}
        <div className="mx-6 my-2 border-t" />

        {/* Next Unlock bubble */}
        <div className="space-y-3">
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Next Unlock - </span>
            <span className="font-semibold text-primary">{nextUnlockLabel}</span>
          </div>

          <div className="flex justify-center">
            <div
              title={nextUnlockName}
              className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md transition-transform hover:scale-105"
            >
              <span className="h-7 w-7"><Shield /></span>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground">{nextUnlockName}</div>
        </div>
      </CardContent>
    </Card>
  );
}
