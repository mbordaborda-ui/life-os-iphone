alter type public.recurrence_type add value if not exists 'custom';

alter table public.activities
  add column if not exists recurrence_weekdays smallint[] not null default '{}'::smallint[];

alter table public.activities
  add column if not exists recurrence_count integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activities_recurrence_weekdays_check'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_recurrence_weekdays_check
      check (recurrence_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'activities_recurrence_count_check'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_recurrence_count_check
      check (recurrence_count is null or recurrence_count > 0);
  end if;
end $$;
