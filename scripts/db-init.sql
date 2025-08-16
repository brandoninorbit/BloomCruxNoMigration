-- scripts/db-init.sql
-- Decks & Cards owned by a user. RLS ensures a user can only see their own.
create table if not exists public.decks (
  id text primary key,
  user_id uuid not null,
  title text not null default '',
  description text not null default '',
  sources jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id text primary key,
  deck_id text not null references public.decks(id) on delete cascade,
  user_id uuid not null,
  card jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.decks enable row level security;
alter table public.cards enable row level security;

-- Policies (Auth.js uses Supabase Auth users; auth.uid() works for RLS)
create policy if not exists "decks_select_own" on public.decks for select
  using (user_id = auth.uid());
create policy if not exists "decks_modify_own" on public.decks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists "cards_select_own" on public.cards for select
  using (user_id = auth.uid());
create policy if not exists "cards_modify_own" on public.cards for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());