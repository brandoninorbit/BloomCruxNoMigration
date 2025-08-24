begin;

alter table if exists public.user_economy
  add column if not exists commander_level integer not null default 1;

-- Backfill existing rows to level 1 if null (defensive)
update public.user_economy set commander_level = 1 where commander_level is null;

commit;
