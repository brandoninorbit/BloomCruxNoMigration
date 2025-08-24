begin;

-- 1) Add cover column to decks for storing optional cover id (text)
alter table if exists public.decks
  add column if not exists cover text;

-- 2) Track which covers a user has purchased (couple with shop events elsewhere)
create table if not exists public.user_cover_purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cover_id text not null,
  purchased_at timestamptz not null default now(),
  unique (user_id, cover_id)
);

create index if not exists idx_ucp_user_id on public.user_cover_purchases(user_id);

alter table public.user_cover_purchases enable row level security;
do $$ begin
  create policy ucp_select on public.user_cover_purchases for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  -- allow the current authenticated user to insert their own purchases
  create policy ucp_insert on public.user_cover_purchases for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  -- allow update/delete/select only for the owning user
  create policy ucp_modify on public.user_cover_purchases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 3) Per-user settings to store default cover preference
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_cover text,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
do $$ begin
  create policy us_select on public.user_settings for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy us_insert on public.user_settings for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy us_update on public.user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

commit;
