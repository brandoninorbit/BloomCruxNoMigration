-- Adds an optional 'source' column to cards to track import provenance

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS source text;
  EXCEPTION WHEN duplicate_column THEN
    NULL;
  END;

  -- Optional supporting index for delete-by-source
  BEGIN
    CREATE INDEX IF NOT EXISTS cards_deck_source_idx ON public.cards (deck_id, source);
  EXCEPTION WHEN duplicate_table THEN
    NULL;
  END;
END$$;

-- DOWN:
-- ALTER TABLE public.cards DROP COLUMN IF EXISTS source;
-- DROP INDEX IF EXISTS cards_deck_source_idx;
