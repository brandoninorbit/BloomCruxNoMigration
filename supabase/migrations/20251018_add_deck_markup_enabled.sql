-- Add a per-deck markup toggle for view-time formatting
alter table if exists public.decks
  add column if not exists markup_enabled boolean not null default true;

-- Backfill existing rows to true (default covers it). Ensure RLS policies remain unchanged.
