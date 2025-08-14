// Ensure Tailwind + tokens + Inter font are loaded for ALL Pages Router routes.
import type { AppProps } from 'next/app';

// Use your path alias so this works from anywhere.
// This imports src/app/globals.css (where Tailwind directives + tokens live).
import '@/app/globals.css';

import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className={inter.className}>
      <Component {...pageProps} />
    </div>
  );
}
