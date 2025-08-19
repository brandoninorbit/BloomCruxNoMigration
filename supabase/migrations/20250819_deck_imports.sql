-- public.deck_imports for tracking CSV/file imports per deck per user
-- idempotent-ish: guard with IF NOT EXISTS where possible

create table if not exists public.deck_imports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  deck_id     bigint not null references public.decks(id) on delete cascade,
  file_hash   text not null,               -- stable hash of the uploaded file (e.g., sha256)
  source      text,                        -- optional: 'csv','manual','template', etc.
  created_at  timestamptz not null default now(),
  unique (user_id, deck_id, file_hash)
);

-- performance indexes
create index if not exists deck_imports_user_id_idx on public.deck_imports(user_id);
create index if not exists deck_imports_deck_id_idx on public.deck_imports(deck_id);
create index if not exists deck_imports_file_hash_idx on public.deck_imports(file_hash);

-- Enable RLS
alter table public.deck_imports enable row level security;

-- Policies: current user can CRUD only their own rows
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'deck_imports' and policyname = 'deck_imports_select_own'
  ) then
    create policy deck_imports_select_own
      on public.deck_imports
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'deck_imports' and policyname = 'deck_imports_insert_own'
  ) then
    create policy deck_imports_insert_own
      on public.deck_imports
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'deck_imports' and policyname = 'deck_imports_update_own'
  ) then
    create policy deck_imports_update_own
      on public.deck_imports
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'deck_imports' and policyname = 'deck_imports_delete_own'
  ) then
    create policy deck_imports_delete_own
      on public.deck_imports
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
