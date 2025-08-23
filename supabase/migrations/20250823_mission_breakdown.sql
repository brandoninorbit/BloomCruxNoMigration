-- Add per-mission Bloom breakdown and mode tagging to mission attempts
begin;

-- 1) Add optional mode and JSONB breakdown columns
alter table public.user_deck_mission_attempts
  add column if not exists mode text check (mode in ('quest','remix','drill','study','starred')),
  add column if not exists breakdown jsonb;

-- 2) Ensure realtime publication includes this table for live updates (safe wrapper)
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.user_deck_mission_attempts';
  exception when others then
    -- ignore if already added
    null;
  end;
end$$;

commit;
