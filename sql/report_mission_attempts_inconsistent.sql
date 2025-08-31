-- Count mission attempts where stored counts differ from breakdown recompute
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
),
flags as (
  select a.id
  from public.user_deck_mission_attempts a
  left join recompute r on r.id = a.id
  where coalesce(a.ended_at, now()) >= now() - interval '60 days'
    and (
      (a.breakdown is not null and (a.cards_seen is distinct from r.total_seen or a.cards_correct is distinct from r.total_correct))
      or a.cards_correct > a.cards_seen
      or a.cards_correct < 0
      or a.cards_seen < 0
    )
)
select
  (select count(*) from flags) as inconsistent_count;
