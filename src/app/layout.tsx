import AuthProvider from '@/app/providers/AuthProvider';
import './globals.css';
import type { Metadata } from 'next';
import { Inter, League_Spartan, Plus_Jakarta_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import Nav from '@/components/Nav';

const inter = Inter({ subsets: ['latin'] });
const uiFont = League_Spartan({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-ui',
});
const contentFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-content',
});
const navFont = localFont({
  src: [
    { path: './fonts/Sansation-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Sansation-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-nav',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BloomCrux',
  description: 'Study smarter with adaptive decks and progress tracking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
  <body className={`${inter.className} ${uiFont.variable} ${contentFont.variable} ${navFont.variable}`}>
        <AuthProvider>
          <Nav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
