-- Mastery pipeline schema: mission attempts, per-card stats, per-bloom mastery aggregates
-- Includes RLS policies and a one-time backfill from existing data.

begin;

-- 1) Mission attempts history
create table if not exists public.user_deck_mission_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  score_pct numeric(5,2) not null,
  cards_seen int not null default 0,
  cards_correct int not null default 0,
  started_at timestamptz,
  ended_at timestamptz not null default now()
);
create index if not exists idx_udma_user_deck_bloom_ended on public.user_deck_mission_attempts (user_id, deck_id, bloom_level, ended_at desc);

-- 2) Per-card SRS stats (durability proxy)
create table if not exists public.user_card_stats (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  card_id bigint not null references public.cards(id) on delete cascade,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  attempts int not null default 0,
  correct int not null default 0,
  streak int not null default 0,
  ease float not null default 2.5,
  interval_days int not null default 0,
  due_at timestamptz,
  stability float,
  last_retrievability float,
  updated_at timestamptz not null default now(),
  unique (user_id, deck_id, card_id)
);
create index if not exists idx_ucs_user_deck_card on public.user_card_stats (user_id, deck_id, card_id);

-- 3) Per-deck per-bloom mastery aggregates
create table if not exists public.user_deck_bloom_mastery (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  correctness_ewma float not null default 0,
  retention_strength float not null default 0,
  coverage float not null default 0,
  mastery_pct int not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, deck_id, bloom_level)
);
create index if not exists idx_udbm_user_deck_bloom on public.user_deck_bloom_mastery(user_id, deck_id, bloom_level);

-- RLS policies
alter table public.user_deck_mission_attempts enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_deck_mission_attempts' and policyname = 'udma_select'
  ) then
    create policy udma_select on public.user_deck_mission_attempts for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_deck_mission_attempts' and policyname = 'udma_modify'
  ) then
    create policy udma_modify on public.user_deck_mission_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end$$;

alter table public.user_card_stats enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_card_stats' and policyname = 'ucs_select'
  ) then
    create policy ucs_select on public.user_card_stats for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_card_stats' and policyname = 'ucs_modify'
  ) then
    create policy ucs_modify on public.user_card_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end$$;

alter table public.user_deck_bloom_mastery enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_deck_bloom_mastery' and policyname = 'udbm_select'
  ) then
    create policy udbm_select on public.user_deck_bloom_mastery for select using (auth.uid() = user_id);
  end if;
end$$;
-- Writes are performed by server with service role; if you also want client writes, create a similar udbm_modify policy.

-- 4) Backfill mastery aggregates from existing attempts and SRS
-- This seeds rows for users/decks/blooms that have either attempts or SRS history.
with cards_cc as (
  select deck_id, bloom_level, count(*) as total_cards
  from public.cards
  group by deck_id, bloom_level
),
last_attempt as (
  select distinct on (user_id, deck_id, bloom_level)
    user_id, deck_id, bloom_level, score_pct::float as last_score
  from public.user_deck_mission_attempts
  order by user_id, deck_id, bloom_level, ended_at desc, id desc
),
srs_join as (
  select s.user_id, s.deck_id, c.bloom_level,
         sum(s.attempts) as attempts_sum,
         sum(s.correct) as correct_sum,
         count(*) filter (where s.attempts > 0) as attempted_cards
  from public.user_deck_srs s
  join public.cards c on c.id = s.card_id
  group by s.user_id, s.deck_id, c.bloom_level
),
keys as (
  select user_id, deck_id, bloom_level from last_attempt
  union
  select user_id, deck_id, bloom_level from srs_join
)
insert into public.user_deck_bloom_mastery (user_id, deck_id, bloom_level, correctness_ewma, retention_strength, coverage, mastery_pct, updated_at)
select
  k.user_id,
  k.deck_id,
  k.bloom_level,
  coalesce(la.last_score, 0) as correctness_ewma,
  case when s.attempted_cards > 0 then greatest(0.2, least(1.0, (s.correct_sum::float / nullif(s.attempts_sum,0)))) else 0 end as retention_strength,
  case when cc.total_cards > 0 then coalesce(s.attempted_cards::float / cc.total_cards, 0) else 0 end as coverage,
  -- mastery_pct = round(0.6 * retention*100 + 0.3 * correctness_ewma + 0.1 * coverage*100)
  cast(round(
    0.6 * (case when s.attempted_cards > 0 then greatest(0.2, least(1.0, (s.correct_sum::float / nullif(s.attempts_sum,0)))) else 0 end) * 100
    + 0.3 * coalesce(la.last_score, 0)
    + 0.1 * (case when cc.total_cards > 0 then coalesce(s.attempted_cards::float / cc.total_cards, 0) else 0 end) * 100
  ) as int) as mastery_pct,
  now() as updated_at
from keys k
left join last_attempt la on la.user_id = k.user_id and la.deck_id = k.deck_id and la.bloom_level = k.bloom_level
left join srs_join s on s.user_id = k.user_id and s.deck_id = k.deck_id and s.bloom_level = k.bloom_level
left join cards_cc cc on cc.deck_id = k.deck_id and cc.bloom_level = k.bloom_level
on conflict (user_id, deck_id, bloom_level) do update set
  correctness_ewma = excluded.correctness_ewma,
  retention_strength = excluded.retention_strength,
  coverage = excluded.coverage,
  mastery_pct = excluded.mastery_pct,
  updated_at = excluded.updated_at;

commit;
