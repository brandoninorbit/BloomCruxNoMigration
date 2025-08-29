-- New token system: decouple tokens from XP, add various token sources
-- This migration creates tables for tracking token sources and removes XP-based token calculation

begin;

-- Table for tracking first-clear bonuses per deck per bloom level
create table if not exists public.user_deck_first_clears (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  tokens_awarded integer not null,
  awarded_at timestamptz not null default now(),
  unique(user_id, deck_id, bloom_level)
);

-- Table for tracking mastery milestone bonuses
create table if not exists public.user_mastery_milestones (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  mastery_pct integer not null,
  tokens_awarded integer not null,
  awarded_at timestamptz not null default now(),
  unique(user_id, deck_id, bloom_level)
);

-- Table for tracking daily mission payouts (for diminishing returns)
create table if not exists public.user_daily_mission_payouts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  payout_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

-- Table for tracking streaks and streak chests
create table if not exists public.user_streaks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_mission_date date,
  three_day_chest_claimed boolean not null default false,
  seven_day_chest_claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- Table for tracking weekly challenges
create table if not exists public.weekly_challenges (
  id bigint generated always as identity primary key,
  week_start date not null,
  week_end date not null,
  objective_type text not null, -- e.g., 'missions_completed', 'cards_mastered', etc.
  target_value integer not null,
  tokens_reward integer not null,
  created_at timestamptz not null default now(),
  unique(week_start, objective_type)
);

create table if not exists public.user_weekly_challenge_completions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id bigint not null references public.weekly_challenges(id) on delete cascade,
  completed_at timestamptz not null default now(),
  tokens_awarded integer not null,
  unique(user_id, challenge_id)
);

-- Table for telemetry tracking
create table if not exists public.token_telemetry (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, -- 'mission_completion', 'first_clear', 'mastery_milestone', 'streak_chest', 'weekly_challenge'
  tokens_earned integer not null,
  bloom_level text check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  deck_id bigint references public.decks(id),
  commander_level integer,
  created_at timestamptz not null default now()
);

-- Enable RLS on all new tables
alter table public.user_deck_first_clears enable row level security;
alter table public.user_mastery_milestones enable row level security;
alter table public.user_daily_mission_payouts enable row level security;
alter table public.user_streaks enable row level security;
alter table public.weekly_challenges enable row level security;
alter table public.user_weekly_challenge_completions enable row level security;
alter table public.token_telemetry enable row level security;

-- RLS policies (users can only see/modify their own data)
create policy udfc_select on public.user_deck_first_clears for select using (auth.uid() = user_id);
create policy udfc_modify on public.user_deck_first_clears for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy umm_select on public.user_mastery_milestones for select using (auth.uid() = user_id);
create policy umm_modify on public.user_mastery_milestones for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy udmp_select on public.user_daily_mission_payouts for select using (auth.uid() = user_id);
create policy udmp_modify on public.user_daily_mission_payouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy us_select on public.user_streaks for select using (auth.uid() = user_id);
create policy us_modify on public.user_streaks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy wc_select on public.weekly_challenges for select using (true); -- public read
create policy uwcc_select on public.user_weekly_challenge_completions for select using (auth.uid() = user_id);
create policy uwcc_modify on public.user_weekly_challenge_completions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy tt_select on public.token_telemetry for select using (auth.uid() = user_id);
create policy tt_modify on public.token_telemetry for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Function to calculate mission completion tokens
create or replace function public.calculate_mission_tokens(
  p_bloom_level text,
  p_score_pct numeric,
  p_is_novelty boolean default false
) returns integer language plpgsql as $$
declare
  base_tokens integer;
  quality_bonus integer := 0;
  novelty_bonus integer := 0;
begin
  -- Base tokens by bloom level
  case p_bloom_level
    when 'Remember' then base_tokens := 12;
    when 'Understand' then base_tokens := 18;
    when 'Apply' then base_tokens := 24;
    when 'Analyze' then base_tokens := 30;
    when 'Evaluate' then base_tokens := 36;
    when 'Create' then base_tokens := 45;
    else base_tokens := 12;
  end case;

  -- Quality bonus for >=85%
  if p_score_pct >= 85 then
    case p_bloom_level
      when 'Remember' then quality_bonus := 4;
      when 'Understand' then quality_bonus := 6;
      when 'Apply' then quality_bonus := 8;
      when 'Analyze' then quality_bonus := 10;
      when 'Evaluate' then quality_bonus := 12;
      when 'Create' then quality_bonus := 15;
      else quality_bonus := 4;
    end case;
  end if;

  -- Novelty bonus
  if p_is_novelty then
    novelty_bonus := ceil((base_tokens + quality_bonus) * 0.15);
  end if;

  return base_tokens + quality_bonus + novelty_bonus;
end;
$$;

-- Function to get diminishing returns multiplier
create or replace function public.get_diminishing_returns_multiplier(
  p_user_id uuid,
  p_date date default current_date
) returns numeric language plpgsql as $$
declare
  payout_count integer;
  multiplier numeric := 1.0;
begin
  select payout_count into payout_count
  from public.user_daily_mission_payouts
  where user_id = p_user_id and date = p_date;

  if payout_count > 10 then
    multiplier := 0.75; -- 25% reduction after 10 payouts
  end if;

  return multiplier;
end;
$$;

-- Function to award tokens (replaces the old increment_user_economy for tokens)
create or replace function public.award_tokens(
  p_user_id uuid,
  p_tokens integer,
  p_event_type text,
  p_bloom_level text default null,
  p_deck_id bigint default null
) returns void language plpgsql as $$
declare
  current_commander_level integer;
begin
  -- Get current commander level
  select commander_level into current_commander_level
  from public.user_economy
  where user_id = p_user_id;

  -- Award tokens
  update public.user_economy
  set tokens = tokens + p_tokens
  where user_id = p_user_id;

  -- Record telemetry
  insert into public.token_telemetry (user_id, event_type, tokens_earned, bloom_level, deck_id, commander_level)
  values (p_user_id, p_event_type, p_tokens, p_bloom_level, p_deck_id, current_commander_level);
end;
$$;

-- Function to increment daily payout count
create or replace function public.increment_daily_payout_count(
  p_user_id uuid
) returns void language plpgsql as $$
begin
  insert into public.user_daily_mission_payouts (user_id, payout_count)
  values (p_user_id, 1)
  on conflict (user_id, date)
  do update set
    payout_count = public.user_daily_mission_payouts.payout_count + 1,
    updated_at = now();
end;
$$;

-- Insert sample weekly challenge for current week
INSERT INTO public.weekly_challenges (week_start, week_end, objective_type, target_value, tokens_reward)
VALUES (
  date_trunc('week', CURRENT_DATE)::date,
  (date_trunc('week', CURRENT_DATE) + interval '6 days')::date,
  'missions_completed',
  10,
  100
) ON CONFLICT (week_start, objective_type) DO NOTHING;

commit;
