-- Repair glitched counts caused by runaway client writes
begin;

-- Recompute and clamp mission attempts over last 120 days
with recompute as (
  select a.id,
    coalesce((select sum(least(
        case when (v->>'cardsSeen') ~ '^[0-9]+(\.[0-9]+)?$' then floor(((v->>'cardsSeen')::numeric)) else 0 end,
        500 -- per mission cap
      )) from jsonb_each(a.breakdown) as e(k,v)),0)::int as total_seen,
    coalesce((select sum(least(
        case when (v->>'cardsCorrect') ~ '^[0-9]+(\.[0-9]+)?$' then floor(((v->>'cardsCorrect')::numeric)) else 0 end,
        case when (v->>'cardsSeen') ~ '^[0-9]+(\.[0-9]+)?$' then floor(((v->>'cardsSeen')::numeric)) else 0 end,
        500
      )) from jsonb_each(a.breakdown) as e(k,v)),0)::int as total_correct
  from public.user_deck_mission_attempts a
  where a.breakdown is not null
)
update public.user_deck_mission_attempts a
set cards_seen = greatest(0, least(coalesce(r.total_seen, a.cards_seen, 0), 500)),
    cards_correct = greatest(0, least(coalesce(r.total_correct, a.cards_correct, 0), cards_seen, 500))
from recompute r
where r.id = a.id
  and (
    a.cards_seen <> greatest(0, least(coalesce(r.total_seen, a.cards_seen, 0), 500))
    or a.cards_correct <> greatest(0, least(coalesce(r.total_correct, a.cards_correct, 0), cards_seen, 500))
  );

-- Clamp SRS per-card totals to sane bounds
update public.user_deck_srs s
set attempts = least(greatest(0, s.attempts), 10000),
    correct  = least(greatest(0, s.correct), least(10000, greatest(0, s.attempts)))
where (s.attempts < 0 or s.correct < 0 or s.correct > s.attempts or s.attempts > 10000);

commit;
