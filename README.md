This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## CSV import (cards)

Supported card types and columns. Use a header row; unknown columns are ignored. Pipe (|) separates multiple values.

- Common columns
  - CardType: one of Standard MCQ, Short Answer, Fill in the Blank, Sorting, Sequencing, Compare/Contrast, Two-Tier MCQ, CER
  - BloomLevel: Remember, Understand, Apply, Analyze, Evaluate, Create (optional)
  - Question or Prompt or Scenario: title of the card
  - Explanation: optional

- Standard MCQ
  - A, B, C, D: option texts
  - Answer: A|B|C|D (case-insensitive)

- Short Answer
  - SuggestedAnswer or Answer

- Fill in the Blank
  - Answer

- Sorting
  - Categories: e.g. "Mammal|Bird|Reptile"
  - Items: "term:category" entries, pipe-delimited, e.g. "Dog:Mammal|Eagle:Bird"

- Sequencing
  - Steps: e.g. "First|Second|Third"

- Compare/Contrast
  - ItemA, ItemB
  - Points: entries as "feature::a::b", pipe-delimited, e.g. "Speed::Fast::Slow|Color::Red::Blue"

- Two-Tier MCQ
  - Tier 1: A, B, C, D, Answer (A|B|C|D)
  - Tier 2: RQuestion, RA, RB, RC, RD, RAnswer (A|B|C|D)

- CER (Claim–Evidence–Reasoning)
  - Mode: "Free Text" or "Multiple Choice"
  - Guidance (optional)
  - If Mode = Multiple Choice:
    - ClaimOptions, ClaimCorrect (1-based index)
    - EvidenceOptions, EvidenceCorrect (1-based index)
    - ReasoningOptions, ReasoningCorrect (1-based index)
  - If Mode = Free Text:
    - Claim, Evidence, Reasoning (sample answers; optional)

Notes
- New SQL migrations add these types to the cards.type check. Ensure they’re applied in your database before importing.

## Database migrations (manual)

This repo includes SQL files under `supabase/migrations`. To apply one against your Supabase `DATABASE_URL`, use the helper script:

```bash
node scripts/run-sql.js supabase/migrations/20250821_bloom_mastery.sql
```

The script reads `.env.local` for `DATABASE_URL`. On Windows with self-signed pooler certs, it disables strict TLS for local dev.
