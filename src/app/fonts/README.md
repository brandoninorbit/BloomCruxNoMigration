Place your Sansation font files here and then I’ll wire them via next/font/local.

Expected filenames (recommended):
- Sansation-Regular.woff2 (weight 400)
- Sansation-Bold.woff2 (weight 700)

TTF works too if you don’t want to convert yet:
- Sansation-Regular.ttf
- Sansation-Bold.ttf

After the files exist, I’ll add this to src/app/layout.tsx:

import localFont from 'next/font/local'

const navFont = localFont({
  src: [
    { path: './fonts/Sansation-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Sansation-Bold.woff2',    weight: '700', style: 'normal' },
  ],
  variable: '--font-nav',
  display: 'swap',
})

…and include navFont.variable in the <body> className.

Optional: convert TTF → WOFF2 for smaller sizes using a CLI:
- npm i -D ttf2woff2-cli
- npx ttf2woff2 .\src\app\fonts\Sansation-Regular.ttf
- npx ttf2woff2 .\src\app\fonts\Sansation-Bold.ttf
