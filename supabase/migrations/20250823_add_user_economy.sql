begin;

create table if not exists public.user_economy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens integer not null default 0,
  commander_xp integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_economy enable row level security;
-- Policies: use DO blocks to avoid errors if they already exist
do $$ begin
  create policy ue_select on public.user_economy for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy ue_modify on public.user_economy for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy ue_insert on public.user_economy for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- helper function for atomic increments
create or replace function public.increment_user_economy(p_user_id uuid, p_tokens_delta integer, p_xp_delta integer)
returns void language plpgsql as $$
begin
  insert into public.user_economy(user_id, tokens, commander_xp)
  values (p_user_id, greatest(0, coalesce(p_tokens_delta,0)), greatest(0, coalesce(p_xp_delta,0)))
  on conflict (user_id)
  do update set
    tokens = public.user_economy.tokens + greatest(0, coalesce(p_tokens_delta,0)),
    commander_xp = public.user_economy.commander_xp + greatest(0, coalesce(p_xp_delta,0)),
    updated_at = now();
end;$$;

commit;
