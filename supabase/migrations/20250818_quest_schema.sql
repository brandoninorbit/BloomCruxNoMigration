-- Quest Mode schema for per-user persistence
-- Tables: user_deck_quest_progress, user_deck_missions, user_deck_srs, user_xp_ledger
-- Assumes existing auth.users

begin;

-- 1) Per-deck, per-user Bloom progress and XP aggregates
create table if not exists public.user_deck_quest_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  -- Per-Bloom JSON aggregate (totals, completed, missionsCompleted, masteryPercent, mastered, commanderGranted, accuracySum, accuracyCount, totalMissions)
  per_bloom jsonb not null default '{}',
  -- XP ledgers per Bloom level
  xp jsonb not null default '{"bloomXp":{},"commanderXp":{},"commanderXpTotal":0,"commanderGranted":{}}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, deck_id)
);

create index if not exists idx_udqp_user_deck on public.user_deck_quest_progress(user_id, deck_id);

-- 2) Missions (sequence + answers) for resume/debug
create table if not exists public.user_deck_missions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  mission_index integer not null default 0,
  sequence_seed text not null,
  card_order bigint[] not null default '{}',
  answered jsonb not null default '[]', -- [{cardId, correct}]
  started_at timestamptz not null default now(),
  resumed_at timestamptz,
  completed_at timestamptz,
  unique (user_id, deck_id, bloom_level, mission_index)
);

create index if not exists idx_udm_user_deck_level on public.user_deck_missions(user_id, deck_id, bloom_level);

-- 3) SRS per card per deck per user
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

create index if not exists idx_uds_user_deck_card on public.user_deck_srs(user_id, deck_id, card_id);

-- 4) Commander/Bloom XP event log (optional but useful)
create table if not exists public.user_xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  event_type text not null check (event_type in ('mission_started','card_answered','mission_completed','bloom_unlocked','bloom_mastered','xp_bloom_added','xp_commander_added')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_uxp_user_deck on public.user_xp_events(user_id, deck_id);

-- RLS: enable and restrict to owner
alter table public.user_deck_quest_progress enable row level security;
create policy if not exists udqp_select on public.user_deck_quest_progress for select using (auth.uid() = user_id);
create policy if not exists udqp_modify on public.user_deck_quest_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.user_deck_missions enable row level security;
create policy if not exists udm_select on public.user_deck_missions for select using (auth.uid() = user_id);
create policy if not exists udm_modify on public.user_deck_missions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.user_deck_srs enable row level security;
create policy if not exists uds_select on public.user_deck_srs for select using (auth.uid() = user_id);
create policy if not exists uds_modify on public.user_deck_srs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.user_xp_events enable row level security;
create policy if not exists uxe_select on public.user_xp_events for select using (auth.uid() = user_id);
create policy if not exists uxe_insert on public.user_xp_events for insert with check (auth.uid() = user_id);

-- Updated at trigger for progress table
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

create trigger udqp_set_updated_at
  before update on public.user_deck_quest_progress
  for each row execute function public.set_updated_at();

commit;
