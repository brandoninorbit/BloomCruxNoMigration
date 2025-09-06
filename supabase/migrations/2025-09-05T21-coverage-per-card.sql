-- 1) Per-card detail rows for each mission attempt
create table if not exists public.user_mission_attempt_cards (
  id bigint generated always as identity primary key,
  attempt_id bigint not null,
  user_id uuid not null,
  deck_id bigint not null,
  bloom_level text not null,
  card_id bigint not null,
  -- fractional correctness in [0, 1]
  correctness numeric(5,4) not null check (correctness >= 0 and correctness <= 1),
  -- convenience flag (you can compute this in queries if you prefer)
  is_correct boolean generated always as (correctness >= 0.65) stored,
  tries integer not null default 1,
  duration_ms integer null,
  answered_at timestamptz not null default now(),
  response jsonb null,

  constraint umac_attempt_fk
    foreign key (attempt_id) references public.user_deck_mission_attempts(id) on delete cascade,

  constraint umac_user_fk
    foreign key (user_id) references auth.users(id) on delete cascade,

  constraint umac_deck_fk
    foreign key (deck_id) references public.decks(id) on delete cascade,

  constraint umac_bloom_level_check check (
    bloom_level = any (array['Remember','Understand','Apply','Analyze','Evaluate','Create'])
  )
);

-- Useful composite index for the common lookup path
create index if not exists idx_umac_user_deck_bloom
  on public.user_mission_attempt_cards (user_id, deck_id, bloom_level, answered_at desc);

-- Query pattern: pull all cards for a given attempt
create index if not exists idx_umac_attempt
  on public.user_mission_attempt_cards (attempt_id);

-- 2) View: coverage across attempts for a user/deck/bloom
create or replace view public.v_user_deck_bloom_coverage as
select
  u.user_id,
  u.deck_id,
  u.bloom_level,
  count(distinct u.card_id) as cards_distinct_seen,
  array_agg(distinct u.card_id order by u.card_id) as card_ids_seen
from public.user_mission_attempt_cards u
group by u.user_id, u.deck_id, u.bloom_level;

-- 3) (Optional) View: best correctness per card (so you can compute mastery from “best-so-far”)
create or replace view public.v_user_deck_bloom_best_per_card as
select
  user_id, deck_id, bloom_level, card_id,
  max(correctness) as best_correctness
from public.user_mission_attempt_cards
group by user_id, deck_id, bloom_level, card_id;
