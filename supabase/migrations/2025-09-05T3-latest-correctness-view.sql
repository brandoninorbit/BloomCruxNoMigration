create or replace view public.v_latest_card_correctness as
select distinct on (user_id, deck_id, bloom_level, card_id)
  user_id, deck_id, bloom_level, card_id, correctness, answered_at
from public.user_mission_attempt_cards
order by user_id, deck_id, bloom_level, card_id, answered_at desc;
