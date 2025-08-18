-- Adds 'Sequencing' to the allowed values for cards.type
-- Run this in Supabase SQL editor or via psql against your project DB.

BEGIN;

-- Adjust schema if your table is not in public
ALTER TABLE public.cards
  DROP CONSTRAINT IF EXISTS cards_type_check;

ALTER TABLE public.cards
  ADD CONSTRAINT cards_type_check
  CHECK (type IN (
    'Standard MCQ',
    'Short Answer',
    'Fill in the Blank',
    'Sorting',
    'Sequencing'
  ));

COMMIT;

-- Optional DOWN (manual): re-add without 'Sequencing'
-- BEGIN;
-- ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_type_check;
-- ALTER TABLE public.cards ADD CONSTRAINT cards_type_check CHECK (type IN ('Standard MCQ','Short Answer','Fill in the Blank','Sorting'));
-- COMMIT;
