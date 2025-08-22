-- Upgrade integer aggregates to numeric to preserve fractional correctness
-- Safe to run multiple times; guarded by column existence checks.

begin;

-- user_deck_mission_attempts.cards_correct from int -> numeric
alter table if exists public.user_deck_mission_attempts
  alter column cards_correct type numeric using cards_correct::numeric;

-- Optionally widen additional aggregate-like columns if they exist in your environment.
-- percent_correct
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_deck_mission_attempts'
      and column_name = 'percent_correct'
  ) then
    execute 'alter table public.user_deck_mission_attempts alter column percent_correct type numeric using percent_correct::numeric';
  end if;
end$$;

-- xp_earned
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_deck_mission_attempts'
      and column_name = 'xp_earned'
  ) then
    execute 'alter table public.user_deck_mission_attempts alter column xp_earned type numeric using xp_earned::numeric';
  end if;
end$$;

-- If you maintain any summary tables with integer totals (e.g., user_deck_missions_*) and want fractional aggregates,
-- replicate guarded casts here. Do not modify answered jsonb.

commit;
