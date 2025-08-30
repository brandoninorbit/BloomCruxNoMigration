-- Migrate user_deck_srs.correct to numeric so we can store fractional correctness (partials)
-- Safe to run multiple times; uses IF EXISTS

begin;

-- Ensure table exists
create table if not exists public.user_deck_srs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  card_id bigint not null references public.cards(id) on delete cascade,
  attempts integer not null default 0,
  correct integer not null default 0,
  last_seen_at timestamptz,
  unique (user_id, deck_id, card_id)
);

-- Change correct from integer to numeric to preserve fractional values
alter table if exists public.user_deck_srs
  alter column correct type numeric using correct::numeric;

-- Keep an explicit default of 0 for numeric
alter table if exists public.user_deck_srs
  alter column correct set default 0;

-- Optional: basic non-negative guards (do not block existing rows)
-- You can uncomment if you want hard guarantees going forward:
-- alter table if exists public.user_deck_srs
--   add constraint user_deck_srs_correct_nonneg check (correct >= 0);
-- alter table if exists public.user_deck_srs
--   add constraint user_deck_srs_attempts_nonneg check (attempts >= 0);

commit;
