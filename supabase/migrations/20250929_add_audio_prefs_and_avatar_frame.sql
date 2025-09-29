begin;

-- Add missing columns to user_settings for avatar frame and audio prefs
alter table if exists public.user_settings
  add column if not exists default_avatar_frame text,
  add column if not exists audio_prefs jsonb;

-- Optional: simple trigger to bump updated_at on changes (if not already present elsewhere)
create or replace function public.touch_user_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger trg_touch_user_settings
  before update on public.user_settings
  for each row execute function public.touch_user_settings_updated_at();
exception when duplicate_object then null; end $$;

commit;
