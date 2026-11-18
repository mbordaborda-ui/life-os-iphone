alter table public.finance_transactions
  drop constraint if exists finance_transactions_kind_check;

alter table public.finance_transactions
  add constraint finance_transactions_kind_check
  check (kind in ('expense', 'income', 'saving'));
