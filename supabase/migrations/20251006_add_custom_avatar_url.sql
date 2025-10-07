-- Add custom_avatar_url column to user_settings for user-uploaded profile pictures
begin;

alter table if exists public.user_settings
  add column if not exists custom_avatar_url text;

commit;
