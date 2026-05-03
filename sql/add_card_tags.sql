-- Migration: Add dimensional topic-tag column to cards table
-- Tags are stored as a JSONB array of {dimension, path} objects.
-- Format: [{"dimension":"topic","path":["vertebrates","mammal"]}, ...]

ALTER TABLE cards ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT NULL;

-- Optional index for efficient tag-based queries (e.g., weak-point detection across a deck)
CREATE INDEX IF NOT EXISTS idx_cards_tags ON cards USING gin (tags);
