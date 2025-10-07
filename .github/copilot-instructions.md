# BloomCrux AI Coding Instructions

## Project Overview

BloomCrux is a Next.js 15 educational platform using Bloom's Taxonomy for spaced repetition learning. Users create decks via CSV import or manual editing, complete missions at 6 Bloom levels (Remember → Create), earn XP/tokens, and track mastery through SM-2 based SRS.

**Tech Stack**: Next.js 15 (App Router), React 19, TypeScript, Supabase (PostgreSQL + Auth), Tailwind CSS 4, Radix UI, Vitest

## Critical Architecture Patterns

### 1. Dual Authentication System

We use **TWO** separate auth approaches—do not mix them:

- **Server Components**: Use `@supabase/ssr` with `createServerClient()` in Server Components and middleware
- **Client Components**: Use `@supabase/auth-helpers-react` with `SessionContextProvider` + `getSupabaseClient()` from `src/lib/supabase/browserClient.ts`

```typescript
// ✅ Server Component/API Route
import { createServerClient } from '@supabase/ssr';

// ✅ Client Component
import { getSupabaseClient } from '@/lib/supabase/browserClient';
const supabase = getSupabaseClient();
```

**Layout wraps all pages** with `<SupabaseProvider>` (see `src/app/layout.tsx` and `src/app/SupabaseProvider.tsx`).

### 2. CSV-First Card System

Every card type **must be CSV-authorable**. The importer (`src/lib/csvImport.ts`) is strict, deterministic, and schema-driven:

- Uses PapaParse with **exact column name matching** (supports aliases like `Question|Prompt|Scenario|Title`)
- No heuristics, no reordering, no deduplication
- Preserves unknown columns (forwards compatibility)
- BloomLevel defaults per type: MCQ/Fill → Remember, Short/Sorting/Sequencing → Understand, Compare → Analyze, Two-Tier/CER → Evaluate

**Card Type Schemas**: See `src/types/deck-cards.ts` for all meta types. When adding/editing card types:
1. Update TypeScript types in `deck-cards.ts`
2. Update CSV parser in `csvImport.ts`
3. Add SQL migration to extend `cards.type` check constraint
4. Update study components in `src/components/cards/`

Example CSV columns for Standard MCQ:
```csv
CardType,Question,A,B,C,D,Answer,Explanation,BloomLevel
Standard MCQ,Which has 3 H-bonds?,A-T,A-U,G≡C,A=G,C,"G≡C forms 3 hydrogen bonds",Remember
```

### 3. Bloom Progression & Quest Unlocking

Missions unlock **sequentially** (Remember → Understand → ... → Create) based on a **composite unlock score** system:

- Default threshold: **65%** (configurable per mission)
- Mastery threshold: **80%** for Bloom level completion
- Unlock logic: `src/lib/quest/unlock.ts` checks highest quest attempt OR composite coverage score from views `v_unlock_basis_mean`/`v_unlock_basis_latest`
- Quest unlocks use **whichever score is higher**: previous quest attempt OR composite per-card mastery (when 100% coverage achieved)

XP Multipliers (from `src/lib/bloom.ts`):
```typescript
Remember: 1.0, Understand: 1.25, Apply: 1.5, 
Analyze: 2.0, Evaluate: 2.5, Create: 3.0
```

Commander XP = Bloom XP × Bloom multiplier

### 4. SM-2 Based SRS with Psychology Enhancements

Core SRS: `src/lib/srs.ts` implements **SM-2 algorithm** with:
- Personalized latency bonuses (per-deck quantiles)
- Relearn ladder with sub-day steps for desirable difficulty
- Interval fuzz (±10%) to promote interleaving
- Retention target scaling (gentle)
- FSRS-lite hooks (difficulty, stability fields) for forward compatibility

```typescript
// SRS state structure (user_deck_srs table)
interface SRSState {
  ef: number;              // Easiness factor
  reps: number;            // Successful reps in a row
  intervalDays: number;    // Last planned interval
  nextDueIso: string;      // ISO date
  lapses: number;          // Count of lapses
  stability: number;       // FSRS-lite memory longevity
  difficulty?: number;     // FSRS-lite 0-1 difficulty
}
```

**Target intervals** by Bloom level (see `src/lib/bloom.ts`):
Remember: 7d, Understand: 10d, Apply: 14d, Analyze: 20d, Evaluate: 25d, Create: 30d

### 5. Database Schema & Persistence

All user state persists to Supabase with RLS policies (`auth.uid() = user_id`):

**Core tables** (see `supabase/migrations/20250818_quest_schema.sql`):
- `decks` / `cards` - Content owned by users
- `user_deck_quest_progress` - Per-Bloom XP, mastery, completion state (JSONB)
- `user_deck_missions` - Mission sequence, resume state (card_order, answered JSONB)
- `user_deck_srs` - SM-2 state per card
- `user_xp_events` - Event log for XP/tokens
- `user_deck_mission_attempts` - Historical mission results with `score_pct`, `percent_correct`, `xp_earned`

**To run migrations**: Use helper script
```bash
node scripts/run-sql.js supabase/migrations/<file>.sql
```

### 6. Mission Flow & Resume Logic

Missions save after **every card** (`user_deck_missions.answered` JSONB array). On logout, user resumes at exact card. Mission types:

- **Quest**: Sequential, shuffled once, unlocks next Bloom level at ≥65%
- **Target Practice**: Uses SM-2 due cards, shows "Engage Target" popup before start
- **Random Remix**: Pure random, no SRS
- **Level Up**: Focused practice on one Bloom level
- **Timed Drill**: Time-limited, awards extra XP, shows "Mission Debrief" popup

Study components: `src/components/cards/{MCQStudy,FillBlankStudy,SequencingStudy}.tsx`

### 7. Token Economy & Shop

Tokens earned via missions (accuracy × Bloom multiplier). Shop access **only from study page** (not global nav).

- Cosmetic-first: avatar frames, deck covers, profile badges
- Higher Commander level = more tokens earned AND higher shop costs (prevents inflation)
- No shortcuts allowed (per `bloomcrux_guide.md` §6)

### 8. Routing & Navigation

**App Router structure**:
- `/about` - Marketing (logged-out default)
- `/dashboard` - Home (logged-in default)
- `/decks` - Deck library with folder organization
- `/decks/[deckId]` - Deck details & manual card editor
- `/study/[deckId]` - Mission launcher
- `/study/[deckId]/quest` - Active mission flow
- `/shop` - Token shop (only accessible from study views)

**Middleware** (`src/middleware.ts`): Redirects logged-out users from protected routes to `/about`, logged-in users from `/` to `/dashboard`

## Development Commands

```bash
# Dev server (Turbopack enabled)
npm run dev

# Production build
npm run build

# Type checking (no emit)
npx tsc --noEmit

# Tests (Vitest + jsdom)
npm test

# Run SQL migration
node scripts/run-sql.js <sql-file-path>
```

**Environment variables** (`.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `DATABASE_URL` (for migration scripts)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (OAuth)

## Code Conventions

### TypeScript
- Strict mode enabled (`tsconfig.json`)
- Use typed Supabase queries: `.select<Type>()` or cast `as Type`
- Card meta types: Use discriminated unions from `src/types/deck-cards.ts`

### Styling
- Tailwind CSS 4 with custom `globals.css` utilities
- Font variables: `--font-ui` (League Spartan), `--font-content` (Plus Jakarta Sans), `--font-nav` (Sansation)
- Theme: Military/ops aesthetic ("Commander Level", "Operation: [mission name]")

### State Management
- Client state: React hooks, local state
- Server state: Direct Supabase queries with RLS
- No global state library—prefer server components where possible

### Testing
- Vitest config: `vitest.config.ts` with `jsdom` environment
- Test files: `**/*.test.ts` or `**/*.test.tsx`
- CSV import has comprehensive tests: `src/lib/csvImport.test.ts`

## Common Pitfalls

1. **Don't mix auth approaches**: Server code uses `@supabase/ssr`, client uses `@supabase/auth-helpers-react`
2. **CSV import is strict**: Must include required columns exactly. No heuristics or auto-fallbacks
3. **Quest unlocking is composite**: Check both highest attempt AND composite coverage score via views
4. **Middleware paths**: Public paths array in `src/middleware.ts` controls access—update when adding public routes
5. **Card type updates**: Require coordinated changes across TypeScript types, CSV parser, SQL constraints, and UI components
6. **Shop access**: Only render from study page, never in global nav
7. **XP calculation**: Always apply Bloom multiplier to base XP for Commander XP

## Key Files Reference

- **Auth**: `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/supabase/browserClient.ts`
- **CSV Import**: `src/lib/csvImport.ts`, `docs/csv-import.md`
- **Card Types**: `src/types/deck-cards.ts`
- **SRS**: `src/lib/srs.ts`, `src/lib/mastery.ts`
- **Bloom Logic**: `src/lib/bloom.ts`, `src/lib/quest/unlock.ts`
- **Database Schema**: `supabase/migrations/20250818_quest_schema.sql`
- **Study Components**: `src/components/cards/`, `src/components/quest/`

## Documentation

- **Project spec**: `bloomcrux_guide.md` (canonical rules & constraints)
- **CSV import**: `docs/csv-import.md` (all card type schemas)
- **README**: Basic Next.js setup + CSV import summary

---

**When in doubt**: Check `bloomcrux_guide.md` for golden rules. Every feature must respect Bloom progression, CSV authorship, and the psychology-first XP model.
