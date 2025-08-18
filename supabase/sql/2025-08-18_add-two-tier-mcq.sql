-- Adds 'Two-Tier MCQ' to the allowed values for cards.type

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_type_check;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;

  ALTER TABLE public.cards
  ADD CONSTRAINT cards_type_check CHECK (
    type IN (
      'Standard MCQ',
      'Short Answer',
      'Fill in the Blank',
      'Sorting',
      'Sequencing',
      'Compare/Contrast',
      'Two-Tier MCQ'
    )
  );
END$$;

-- No extra trigger needed; Two-Tier MCQ meta is self-contained.

-- DOWN:
-- ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_type_check;
-- ALTER TABLE public.cards ADD CONSTRAINT cards_type_check CHECK (
--   type IN ('Standard MCQ','Short Answer','Fill in the Blank','Sorting','Sequencing','Compare/Contrast')
-- );
