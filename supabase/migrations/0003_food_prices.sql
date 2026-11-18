alter table public.foods
  add column price numeric(12, 2) check (price is null or price >= 0);
