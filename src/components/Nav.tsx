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
  <header className="site-nav fixed top-0 left-0 right-0 z-[200] w-full border-b border-border shadow-sm bg-[linear-gradient(to_bottom,rgba(255,255,255,0.78),rgba(255,255,255,0.55))] dark:bg-[linear-gradient(to_bottom,rgba(20,20,20,0.78),rgba(20,20,20,0.55))] backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 lg-regular lg-specular">
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
