-- Adds 'Compare/Contrast' to the allowed values for cards.type
-- and introduces a trigger to sanitize Sorting items when categories
-- are removed or renamed (clears invalid correctCategory selections).

-- UP ---------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_type_check;
  EXCEPTION WHEN undefined_object THEN
    -- constraint may not exist yet
    NULL;
  END;

  -- Recreate the check constraint with all currently supported types
  ALTER TABLE public.cards
  ADD CONSTRAINT cards_type_check CHECK (
    type IN (
      'Standard MCQ',
      'Short Answer',
      'Fill in the Blank',
      'Sorting',
      'Sequencing',
      'Compare/Contrast'
    )
  );
END$$;

-- Function: sanitize sorting meta (clears invalid item.correctCategory)
CREATE OR REPLACE FUNCTION public.sanitize_sorting_meta(meta jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  cats text[] := ARRAY[]::text[];
  new_items jsonb := '[]'::jsonb;
BEGIN
  -- Extract categories as text[] (handle missing/null)
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  INTO cats
  FROM jsonb_array_elements_text(COALESCE(meta->'categories', '[]'::jsonb)) AS value;

  -- Rebuild items with corrected category values
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN (i->>'correctCategory') IS NOT NULL
             AND (i->>'correctCategory') <> ''
             AND (i->>'correctCategory') = ANY(cats)
          THEN i
        ELSE jsonb_set(i, '{correctCategory}', to_jsonb(''::text), true)
      END
    ),
    '[]'::jsonb
  )
  INTO new_items
  FROM jsonb_array_elements(COALESCE(meta->'items', '[]'::jsonb)) AS i;

  RETURN jsonb_set(
    COALESCE(meta, '{}'::jsonb),
    '{items}',
    COALESCE(new_items, '[]'::jsonb),
    true
  );
END;
$$;

-- Trigger function: apply sanitation on INSERT/UPDATE for Sorting
CREATE OR REPLACE FUNCTION public.cards_before_ins_upd_sanitize()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'Sorting' THEN
    NEW.meta := public.sanitize_sorting_meta(NEW.meta);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_cards_sanitize_sorting ON public.cards;
CREATE TRIGGER trg_cards_sanitize_sorting
BEFORE INSERT OR UPDATE OF meta, type ON public.cards
FOR EACH ROW EXECUTE PROCEDURE public.cards_before_ins_upd_sanitize();

-- DOWN -------------------------------------------------------------
-- Note: Reverting data sanitation is not practical. To rollback types, run:
-- ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_type_check;
-- ALTER TABLE public.cards ADD CONSTRAINT cards_type_check CHECK (
--   type IN ('Standard MCQ','Short Answer','Fill in the Blank','Sorting','Sequencing')
-- );
-- DROP TRIGGER IF EXISTS trg_cards_sanitize_sorting ON public.cards;
-- DROP FUNCTION IF EXISTS public.cards_before_ins_upd_sanitize();
-- DROP FUNCTION IF EXISTS public.sanitize_sorting_meta(jsonb);
