-- Add target_practice mode to user_deck_mission_attempts
begin;

alter table public.user_deck_mission_attempts
  drop constraint if exists user_deck_mission_attempts_mode_check,
  add constraint user_deck_mission_attempts_mode_check 
    check (mode in ('quest','remix','drill','study','starred','target_practice'));

commit;
