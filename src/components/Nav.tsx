'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import AuthStatus from '@/components/AuthStatus'; // ✅ added
import Image from 'next/image';

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/decks', label: 'Decks' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/shop', label: 'Shop' },
];

export default function Nav() {
  const pathname = usePathname() ?? '/';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Brand with logo */}
  <Link href="/" className="font-valid font-bold tracking-tight text-2xl md:text-3xl">
          <span className="inline-flex items-center gap-2">
            <Image src="/logo.svg" alt="BloomCrux logo" width={24} height={24} priority />
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
      'rounded-lg px-3 py-2 transition-colors',
      isActive ? 'text-slate-950 text-xl' : 'text-lg text-slate-600 hover:text-slate-900'
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* 🔁 Only this right-side auth area changed */}
        <AuthStatus />
      </nav>
    </header>
  );
}
