-- Persist deck-level mastery and server-side aggregation helpers
begin;

-- 1) Add deck_mastered fields to per-deck progress
alter table if exists public.user_deck_quest_progress
  add column if not exists deck_mastered boolean not null default false,
  add column if not exists deck_mastered_at timestamptz;

-- 2) Function: compute whether a deck is mastered (all blooms except Create >= 80%)
create or replace function public.compute_deck_mastered(p_user uuid, p_deck bigint)
returns boolean
language sql
stable
as $$
  with required as (
    select unnest(array['Remember','Understand','Apply','Analyze','Evaluate']::text[]) as bloom
  ),
  mastered as (
    select count(*) as mastered_count
    from public.user_deck_bloom_mastery m
    join required r on r.bloom = m.bloom_level
    where m.user_id = p_user and m.deck_id = p_deck and coalesce(m.mastery_pct,0) >= 80
  )
  select (select mastered_count from mastered) = (select count(*) from required);
$$;

-- 3) Procedure: refresh and persist deck_mastered on progress table
create or replace function public.refresh_user_deck_mastered(p_user uuid, p_deck bigint)
returns void
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_is_mastered boolean := public.compute_deck_mastered(p_user, p_deck);
  v_prev boolean;
  v_prev_at timestamptz;
begin
  -- ensure row exists
  insert into public.user_deck_quest_progress(user_id, deck_id)
  values (p_user, p_deck)
  on conflict (user_id, deck_id) do nothing;

  select deck_mastered, deck_mastered_at into v_prev, v_prev_at
  from public.user_deck_quest_progress
  where user_id = p_user and deck_id = p_deck
  for update;

  if v_prev is distinct from v_is_mastered then
    update public.user_deck_quest_progress
    set deck_mastered = v_is_mastered,
        deck_mastered_at = case
          when v_is_mastered and (v_prev_at is null) then v_now
          when not v_is_mastered then null
          else v_prev_at
        end,
        updated_at = v_now
    where user_id = p_user and deck_id = p_deck;
  end if;
end;
$$;

-- 4) Trigger: when bloom mastery changes, recompute deck_mastered
create or replace function public.trg_after_bloom_mastery_upd()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.refresh_user_deck_mastered(new.user_id, new.deck_id);
  return null;
end;
$$;

drop trigger if exists after_bloom_mastery_upd on public.user_deck_bloom_mastery;
create trigger after_bloom_mastery_upd
  after insert or update of mastery_pct on public.user_deck_bloom_mastery
  for each row execute function public.trg_after_bloom_mastery_upd();

-- 5) View: reviewed card counts per user/deck
create or replace view public.user_deck_reviewed_counts as
select user_id, deck_id, count(*) filter (where attempts > 0) as reviewed_cards
from public.user_deck_srs
group by user_id, deck_id;

-- 6) Backfill existing rows
do $$
declare
  r record;
begin
  for r in (
    select distinct user_id, deck_id from public.user_deck_bloom_mastery
  ) loop
    perform public.refresh_user_deck_mastered(r.user_id, r.deck_id);
  end loop;
end$$;

commit;
