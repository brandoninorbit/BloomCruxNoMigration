-- Add mission_index to user_deck_mission_attempts so each quest attempt
-- records which mission number (0-based) was completed for that bloom level.
-- Also adds mode and answers_json columns if not present (idempotent).

begin;

alter table public.user_deck_mission_attempts
  add column if not exists mission_index integer;

-- Index for chronological repair queries
create index if not exists idx_udma_user_deck_bloom_mi
  on public.user_deck_mission_attempts (user_id, deck_id, bloom_level, mission_index);

commit;
