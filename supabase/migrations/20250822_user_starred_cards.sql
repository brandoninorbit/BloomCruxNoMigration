begin;

create table if not exists public.user_starred_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id integer not null references public.decks(id) on delete cascade,
  card_id integer not null references public.cards(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deck_id, card_id)
);

alter table public.user_starred_cards enable row level security;

-- RLS: owner can read/write their rows
do $$ begin
  create policy usc_select on public.user_starred_cards for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy usc_insert on public.user_starred_cards for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy usc_delete on public.user_starred_cards for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

commit;
