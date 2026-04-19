-- Add a small per-deck, per-bloom mastery update history table
-- and helper to keep only the most recent 3 updates per bloom.

begin;

create table if not exists public.user_deck_bloom_mastery_updates (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id bigint not null references public.decks(id) on delete cascade,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  attempt_id bigint null references public.user_deck_mission_attempts(id) on delete set null,
  attempt_mode text null check (attempt_mode in ('quest','remix','drill','study','starred','target_practice')),
  score_pct numeric(5,2) not null,
  mastery_pct int not null,
  correctness_ewma float not null,
  retention_strength float not null,
  coverage float not null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_udbmu_user_deck_bloom_updated on public.user_deck_bloom_mastery_updates (user_id, deck_id, bloom_level, updated_at desc);

alter table public.user_deck_bloom_mastery_updates enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_deck_bloom_mastery_updates' and policyname = 'udbmu_select'
  ) then
    create policy udbmu_select on public.user_deck_bloom_mastery_updates for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_deck_bloom_mastery_updates' and policyname = 'udbmu_modify'
  ) then
    create policy udbmu_modify on public.user_deck_bloom_mastery_updates for insert with check (auth.uid() = user_id);
  end if;
end$$;

create or replace function public.prune_user_deck_bloom_mastery_updates(
  p_user uuid,
  p_deck bigint,
  p_bloom text,
  p_keep int default 3
)
returns void
language sql
security definer
as $$
  delete from public.user_deck_bloom_mastery_updates
  where id in (
    select id
    from public.user_deck_bloom_mastery_updates
    where user_id = p_user and deck_id = p_deck and bloom_level = p_bloom
    order by updated_at desc, id desc
    offset p_keep
  );
$$;

commit;
