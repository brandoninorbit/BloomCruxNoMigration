-- Repair inconsistent mission attempts by recomputing cards_seen and cards_correct from breakdown JSONB.
-- Safe to run multiple times; only updates rows where recomputed totals differ.
-- Scope limited to last 60 days; adjust interval if needed.

with recompute as (
  select
    a.id,
    coalesce((
      select sum(
        case when (v->>'cardsSeen') ~ '^[0-9]+(\.[0-9]+)?$'
          then floor(((v->>'cardsSeen')::numeric))
          else 0 end
      )
      from jsonb_each(a.breakdown) as e(k, v)
    ), 0)::int as total_seen,
    coalesce((
      select sum(
        least(
          case when (v->>'cardsCorrect') ~ '^[0-9]+(\.[0-9]+)?$' then floor(((v->>'cardsCorrect')::numeric)) else 0 end,
          case when (v->>'cardsSeen') ~ '^[0-9]+(\.[0-9]+)?$' then floor(((v->>'cardsSeen')::numeric)) else 0 end
        )
      )
      from jsonb_each(a.breakdown) as e(k, v)
    ), 0)::int as total_correct
  from public.user_deck_mission_attempts a
  where a.breakdown is not null
    and coalesce(a.ended_at, now()) >= now() - interval '60 days'
)
update public.user_deck_mission_attempts a
set
  cards_seen = greatest(0, r.total_seen),
  cards_correct = greatest(0, least(r.total_correct, r.total_seen))
from recompute r
where a.id = r.id
  and (
    a.cards_seen is distinct from r.total_seen
    or a.cards_correct is distinct from r.total_correct
  );

-- Optional: cap any absurd values even without breakdown (defensive clean-up)
update public.user_deck_mission_attempts
set
  cards_correct = greatest(0, least(cards_correct, cards_seen)),
  score_pct = case when cards_seen > 0 then round((cards_correct::numeric / cards_seen::numeric) * 100, 1) else score_pct end
where coalesce(ended_at, now()) >= now() - interval '60 days'
  and (cards_correct > cards_seen or cards_correct < 0 or cards_seen < 0);
