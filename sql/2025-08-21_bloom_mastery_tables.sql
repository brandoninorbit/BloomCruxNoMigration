-- Mission attempts history
create table if not exists user_deck_mission_attempts (
  id bigserial primary key,
  user_id uuid not null,
  deck_id bigint not null,
  bloom_level text not null check (bloom_level in ('Remember','Understand','Apply','Analyze','Evaluate','Create')),
  score_pct numeric(5,2) not null,
  cards_seen int not null default 0,
  cards_correct int not null default 0,
  started_at timestamptz,
  ended_at timestamptz not null default now()
);
create index if not exists idx_udma_user_deck_bloom_ended on user_deck_mission_attempts (user_id, deck_id, bloom_level, ended_at desc);

-- Per-card SRS stats (durability proxy)
create table if not exists user_card_stats (
  id bigserial primary key,
  user_id uuid not null,
  deck_id bigint not null,
  card_id bigint not null,
  bloom_level text not null,
  attempts int not null default 0,
  correct int not null default 0,
  streak int not null default 0,
  ease float not null default 2.5,
  interval_days int not null default 0,
  due_at timestamptz,
  stability float,
  last_retrievability float,
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_user_card_stats on user_card_stats (user_id, deck_id, card_id);

-- Per-deck per-bloom mastery aggregates
create table if not exists user_deck_bloom_mastery (
  id bigserial primary key,
  user_id uuid not null,
  deck_id bigint not null,
  bloom_level text not null,
  correctness_ewma float not null default 0,
  retention_strength float not null default 0,
  coverage float not null default 0,
  mastery_pct int not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, deck_id, bloom_level)
);
