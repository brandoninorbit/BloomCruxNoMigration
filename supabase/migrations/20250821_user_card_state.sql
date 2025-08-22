-- Create table to persist per-user per-card UI/algorithm state (non-SRS), e.g., last seen inputs.
-- Schema: public.user_card_state(user_id uuid, card_id bigint, bloom text, state jsonb, updated_at timestamptz)
-- Constraints: UNIQUE(user_id, card_id); FKs to auth.users(id) and public.cards(id)

create table if not exists public.user_card_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id bigint not null references public.cards(id) on delete cascade,
  bloom text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_card_state_user_card_unique unique (user_id, card_id)
);

-- Optional supporting indexes (unique constraint already indexes (user_id, card_id))
create index if not exists idx_ucs_user on public.user_card_state(user_id);
create index if not exists idx_ucs_card on public.user_card_state(card_id);

-- No data backfill required.
