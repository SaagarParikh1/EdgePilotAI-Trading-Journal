create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  ticker text not null,
  asset_type text not null,
  broker text,
  side text,
  setup text not null,
  entry_price numeric(14, 4),
  exit_price numeric(14, 4),
  position_size numeric(14, 4),
  pnl numeric(14, 2) not null,
  risk_percent numeric(6, 2),
  planned_risk numeric(14, 2),
  actual_risk numeric(14, 2),
  r_multiple numeric(8, 3),
  duration_minutes integer,
  trade_date date not null,
  trade_time time,
  session text,
  market_regime text,
  volume_regime text,
  emotion_tags text[] default '{}',
  notes text,
  screenshot_url text,
  rule_adherence integer check (rule_adherence between 0 and 100),
  stop_respected boolean default true,
  confidence integer check (confidence between 1 and 10),
  stress integer check (stress between 1 and 10),
  sleep integer check (sleep between 1 and 10),
  focus integer check (focus between 1 and 10),
  is_revenge boolean default false,
  is_fomo boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists psychology_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  log_date date not null,
  confidence integer check (confidence between 1 and 10),
  stress integer check (stress between 1 and 10),
  sleep integer check (sleep between 1 and 10),
  focus integer check (focus between 1 and 10),
  emotional_state text not null,
  distractions integer check (distractions between 0 and 10),
  journal text,
  created_at timestamptz not null default now()
);

create table if not exists ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category text not null,
  severity text not null,
  insight text not null,
  metric text,
  source_trade_ids uuid[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists discipline_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  risk_management integer check (risk_management between 0 and 100),
  stop_respect integer check (stop_respect between 0 and 100),
  emotional_control integer check (emotional_control between 0 and 100),
  consistency integer check (consistency between 0 and 100),
  score_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists trades_user_date_idx on trades(user_id, trade_date desc);
create index if not exists trades_user_setup_idx on trades(user_id, setup);
create index if not exists psychology_logs_user_date_idx on psychology_logs(user_id, log_date desc);
create index if not exists ai_insights_user_created_idx on ai_insights(user_id, created_at desc);
