-- Add content_version to user_deck_mission_attempts to snapshot deck content state at attempt time
alter table if exists public.user_deck_mission_attempts
  add column if not exists content_version integer default 0 not null;

-- Optional: index to filter/aggregate by content_version
create index if not exists user_deck_mission_attempts_content_version_idx
  on public.user_deck_mission_attempts (deck_id, bloom_level, content_version);
