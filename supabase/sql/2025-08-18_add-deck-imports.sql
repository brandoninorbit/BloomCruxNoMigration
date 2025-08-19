-- Track CSV imports by hash to prevent accidental duplicates across sessions

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.deck_imports (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    deck_id bigint not null references public.decks(id) on delete cascade,
    source text not null,
    file_hash text not null,
    created_at timestamptz not null default now(),
    unique (user_id, deck_id, file_hash)
  );

  CREATE INDEX IF NOT EXISTS deck_imports_deck_source_idx ON public.deck_imports(deck_id, source);

  ALTER TABLE public.deck_imports ENABLE ROW LEVEL SECURITY;
  CREATE POLICY IF NOT EXISTS deck_imports_owner_select ON public.deck_imports FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY IF NOT EXISTS deck_imports_owner_modify ON public.deck_imports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
END$$;

-- DOWN
-- DROP TABLE IF EXISTS public.deck_imports;
