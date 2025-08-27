'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import AuthStatus from '@/components/AuthStatus'; // ✅ added
import SettingsSheet from '@/components/settings/SettingsSheet';
import Image from 'next/image';

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/decks', label: 'Decks' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/shop', label: 'Cosmetics' },
];

export default function Nav() {
  const pathname = usePathname() ?? '/';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Brand with logo */}
  <Link href="/" className="font-valid font-bold tracking-tight text-2xl md:text-3xl">
          <span className="inline-flex items-center gap-2">
            <Image src="/logo.svg" alt="BloomCrux logo" width={24} height={24} priority className="size-18" />
            <span>BloomCrux</span>
          </span>
        </Link>

        {/* Main nav links (unchanged) */}
  <div className="font-nav flex items-center gap-3">
          {links.map((l) => {
            const isActive = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "px-3 py-2 rounded transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Right side: settings gear + auth menu */}
        <div className="flex items-center gap-3">
          <SettingsSheet />
          <AuthStatus />
        </div>
      </nav>
    </header>
  );
}
