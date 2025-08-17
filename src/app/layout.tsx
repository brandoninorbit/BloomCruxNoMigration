import SupabaseProvider from '@/app/providers/SupabaseProvider';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Nav from '@/components/Nav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BloomCrux',
  description: 'Study smarter with adaptive decks and progress tracking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <SupabaseProvider>
          <Nav />
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
