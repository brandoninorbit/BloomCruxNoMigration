'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import AuthStatus from '@/components/AuthStatus'; // ✅ added

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/decks', label: 'Decks' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/shop', label: 'Shop' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Brand (unchanged) */}
        <Link href="/" className="font-semibold tracking-tight">
          BloomCrux
        </Link>

        {/* Main nav links (unchanged) */}
        <div className="flex items-center gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground',
                pathname === l.href && 'bg-muted text-foreground'
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* 🔁 Only this right-side auth area changed */}
        <AuthStatus />
      </nav>
    </header>
  );
}
