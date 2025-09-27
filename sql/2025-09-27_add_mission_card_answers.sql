-- Per-mission per-card answer persistence
-- Creates a detail table plus JSON column addition for quick retrieval.

-- 1. Detail table (normalized rows)
create table if not exists user_deck_mission_card_answers (
  id bigserial primary key,
  attempt_id bigint not null references user_deck_mission_attempts(id) on delete cascade,
  user_id uuid not null,
  deck_id bigint not null,
  card_id bigint not null,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  correct_fraction real not null check (correct_fraction >= 0 and correct_fraction <= 1),
  answered_at timestamptz not null default now()
);
create index if not exists idx_udmca_attempt on user_deck_mission_card_answers (attempt_id);
create index if not exists idx_udmca_user_deck on user_deck_mission_card_answers (user_id, deck_id);

-- 2. Lightweight JSON snapshot column on attempts for direct fetch (optional; nullable)
alter table user_deck_mission_attempts
  add column if not exists answers_json jsonb;
create index if not exists idx_udma_answers_json on user_deck_mission_attempts using gin (answers_json);

-- 3. RLS policies (assumes RLS enabled elsewhere). Adjust if needed.
-- Allow owner to select/insert their own rows.
-- (Wrap in DO blocks to ignore errors if policy names already exist.)

-- Enable RLS (safe if already enabled)
alter table user_deck_mission_card_answers enable row level security;

-- Policy names chosen uniquely to avoid collision.
-- Supabase/Postgres does not support IF NOT EXISTS on CREATE POLICY; use DO blocks to avoid errors if they already exist.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_deck_mission_card_answers' AND policyname = 'sel_mission_card_answers'
  ) THEN
    CREATE POLICY sel_mission_card_answers ON public.user_deck_mission_card_answers
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_deck_mission_card_answers' AND policyname = 'ins_mission_card_answers'
  ) THEN
    CREATE POLICY ins_mission_card_answers ON public.user_deck_mission_card_answers
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- For answers_json column, existing policies on user_deck_mission_attempts should suffice.
