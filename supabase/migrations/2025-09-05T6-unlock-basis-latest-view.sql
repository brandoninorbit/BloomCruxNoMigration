create or replace view public.v_unlock_basis_latest as
with total as (
  select deck_id, bloom_level, count(*) as total_cards
  from public.cards
  group by deck_id, bloom_level
),
latest as (
  select user_id, deck_id, bloom_level,
         count(distinct card_id) as seen_cards,
         avg(correctness) as mean_correctness_latest
  from public.v_latest_card_correctness
  group by user_id, deck_id, bloom_level
)
select
  l.user_id,
  l.deck_id,
  l.bloom_level,
  t.total_cards,
  l.seen_cards,
  case when l.seen_cards = t.total_cards
       then round(l.mean_correctness_latest * 100, 2)
       else null
  end as composite_score_pct_when_coverage_100
from latest l
join total t
  on t.deck_id = l.deck_id and t.bloom_level = l.bloom_level;
