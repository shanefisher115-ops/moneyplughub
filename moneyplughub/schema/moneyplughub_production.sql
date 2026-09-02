-- ==============================================================================
-- PrimordiaOS / MoneyPlugHub Canonical Production Database Schema
-- Version: 2026.08.31 (Release 1.0)
-- Engine: PostgreSQL 15+ / Supabase
-- ==============================================================================

create extension if not exists "pgcrypto";

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 1. USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create trigger tr_users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

-- 2. ACCOUNTS
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  type text not null,
  institution text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);
create trigger tr_accounts_updated_at
  before update on public.accounts
  for each row execute function public.handle_updated_at();

-- 3. CATEGORIES
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists idx_categories_user_id on public.categories(user_id);
create trigger tr_categories_updated_at
  before update on public.categories
  for each row execute function public.handle_updated_at();

-- 4. TRANSACTIONS
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(14, 2) not null,
  currency text default 'USD' not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  timestamp timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_account_id on public.transactions(account_id);
create index if not exists idx_transactions_category_id on public.transactions(category_id);
create index if not exists idx_transactions_timestamp on public.transactions(timestamp desc);

create trigger tr_transactions_updated_at
  before update on public.transactions
  for each row execute function public.handle_updated_at();

-- 5. TRANSACTION_RULES
create table if not exists public.transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pattern text not null,
  action text not null,
  category_id uuid references public.categories(id) on delete set null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists idx_transaction_rules_user_id on public.transaction_rules(user_id);
create trigger tr_transaction_rules_updated_at
  before update on public.transaction_rules
  for each row execute function public.handle_updated_at();

-- 6. GOALS
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null,
  current_amount numeric(14, 2) default 0.00 not null,
  deadline timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists idx_goals_user_id on public.goals(user_id);
create trigger tr_goals_updated_at
  before update on public.goals
  for each row execute function public.handle_updated_at();

-- 7. REFERRALS
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  program text not null,
  referral_code text,
  referral_url text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists idx_referrals_user_id on public.referrals(user_id);
create trigger tr_referrals_updated_at
  before update on public.referrals
  for each row execute function public.handle_updated_at();

-- 8. AGENTS
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  role text not null,
  state jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists idx_agents_user_id on public.agents(user_id);
create trigger tr_agents_updated_at
  before update on public.agents
  for each row execute function public.handle_updated_at();

-- 9. LEDGER_EVENTS
create table if not exists public.ledger_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  event_type text not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create index if not exists idx_ledger_events_user_id on public.ledger_events(user_id);
create index if not exists idx_ledger_events_transaction_id on public.ledger_events(transaction_id);
create index if not exists idx_ledger_events_created_at on public.ledger_events(created_at desc);

-- ROW LEVEL SECURITY
alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_rules enable row level security;
alter table public.goals enable row level security;
alter table public.referrals enable row level security;
alter table public.agents enable row level security;
alter table public.ledger_events enable row level security;