-- FINANCE PANEL --------------------------------------------------------------
-- Tracks monthly income and expenses, a monthly savings target and the
-- emergency fund. Statistics are derived from real transactions.

create table public.finance_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  monthly_income numeric(12, 2) not null default 0 check (monthly_income >= 0),
  savings_target numeric(12, 2) not null default 0 check (savings_target >= 0),
  emergency_target numeric(12, 2) not null default 0 check (emergency_target >= 0),
  emergency_balance numeric(12, 2) not null default 0 check (emergency_balance >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (id, user_id)
);

create trigger finance_plan_updated_at before update on public.finance_plan
for each row execute function public.set_updated_at();

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tx_date date not null default current_date,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  category text,
  description text not null check (length(trim(description)) > 0),
  amount numeric(12, 2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index finance_transactions_user_date_idx on public.finance_transactions(user_id, tx_date desc);
create index finance_transactions_user_kind_idx on public.finance_transactions(user_id, kind);

create trigger finance_transactions_updated_at before update on public.finance_transactions
for each row execute function public.set_updated_at();

alter table public.finance_plan enable row level security;
alter table public.finance_transactions enable row level security;

create policy "own_select" on public.finance_plan for select using ((select auth.uid()) = user_id);
create policy "own_insert" on public.finance_plan for insert with check ((select auth.uid()) = user_id);
create policy "own_update" on public.finance_plan for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own_delete" on public.finance_plan for delete using ((select auth.uid()) = user_id);

create policy "own_select" on public.finance_transactions for select using ((select auth.uid()) = user_id);
create policy "own_insert" on public.finance_transactions for insert with check ((select auth.uid()) = user_id);
create policy "own_update" on public.finance_transactions for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own_delete" on public.finance_transactions for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.finance_plan to authenticated;
grant select, insert, update, delete on public.finance_transactions to authenticated;
