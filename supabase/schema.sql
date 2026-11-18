-- LIFE OS - ESQUEMA DEFINITIVO
-- Generado desde supabase/migrations (0001_life_os_schema.sql a 0011_finance_savings_withdrawals.sql)
-- Ejecutar en un proyecto Supabase NUEVO desde el SQL Editor.
-- En el proyecto actual las migraciones ya estan aplicadas; no ejecutes este archivo alli.
-- Tambien puedes aplicar las migraciones con: supabase db push


-- ============================================================
-- 0001_life_os_schema.sql
-- ============================================================

-- LIFE OS · schema, constraints, triggers and Row Level Security
-- Apply with: supabase db push
-- Every private table is scoped to auth.uid(). No service_role key is used by the client.

create extension if not exists pgcrypto;

create type public.category_kind as enum ('activity', 'task', 'recipe', 'food');
create type public.recurrence_type as enum ('none', 'daily', 'weekly', 'monthly');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.task_status as enum ('pending', 'completed');
create type public.goal_period as enum ('weekly', 'monthly');
create type public.goal_status as enum ('active', 'completed', 'archived');
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.frequency_period as enum ('weekly', 'monthly');
create type public.pantry_reason as enum ('purchase', 'consumption', 'waste', 'adjustment');
create type public.shopping_status as enum ('open', 'completed');
create type public.workout_type as enum ('strength', 'cardio', 'other', 'rest');
create type public.session_status as enum ('completed', 'skipped');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- PROFILES ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  timezone text not null default 'Europe/Madrid',
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- CATEGORIES ----------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.category_kind not null,
  name text not null check (length(trim(name)) > 0),
  color text not null default '#b8f36b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

create index categories_user_kind_idx on public.categories(user_id, kind);

create trigger categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();

-- AGENDA --------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  location text,
  category_id uuid references public.categories(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  recurrence public.recurrence_type not null default 'none',
  recurrence_until date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at >= start_at)
);

create index activities_user_start_idx on public.activities(user_id, start_at);
create index activities_user_end_idx on public.activities(user_id, end_at);

create trigger activities_updated_at before update on public.activities
for each row execute function public.set_updated_at();

-- TASKS ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  priority public.task_priority not null default 'medium',
  due_date date,
  category_id uuid references public.categories(id) on delete set null,
  status public.task_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index tasks_user_status_due_idx on public.tasks(user_id, status, due_date);

create trigger tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

-- NOTES ---------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Sin título',
  content text not null default '',
  tags text[] not null default '{}',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_pinned_idx on public.notes(user_id, is_pinned desc, updated_at desc);

create trigger notes_updated_at before update on public.notes
for each row execute function public.set_updated_at();

-- GOALS ---------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  period public.goal_period not null default 'weekly',
  metric_unit text not null default 'acciones',
  target_value numeric(12, 2) not null check (target_value > 0),
  start_date date not null default current_date,
  end_date date,
  status public.goal_status not null default 'active',
  category_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (end_date is null or end_date >= start_date)
);

create table public.goal_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  value numeric(12, 2) not null,
  recorded_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete cascade
);

create index goal_progress_user_date_idx on public.goal_progress(user_id, recorded_on);

create table public.goal_task_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  task_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (goal_id, task_id),
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete cascade,
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade
);

create trigger goals_updated_at before update on public.goals
for each row execute function public.set_updated_at();

-- RECIPES -------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  instructions text not null default '',
  prep_minutes integer check (prep_minutes is null or prep_minutes >= 0),
  servings numeric(8, 2) not null default 1 check (servings > 0),
  category_id uuid references public.categories(id) on delete set null,
  is_favorite boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create trigger recipes_updated_at before update on public.recipes
for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  quantity numeric(10, 3) not null check (quantity > 0),
  unit text not null default 'ud',
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (recipe_id, user_id) references public.recipes(id, user_id) on delete cascade
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id, position);

-- MEAL PLANNER & FOOD LOG ---------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  meal_type public.meal_type not null,
  recipe_id uuid references public.recipes(id) on delete set null,
  title text,
  servings numeric(8, 2) not null default 1 check (servings > 0),
  notes text,
  is_consumed boolean not null default false,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (recipe_id is not null or (title is not null and length(trim(title)) > 0))
);

create index meal_plans_user_date_idx on public.meal_plans(user_id, plan_date);

create trigger meal_plans_updated_at before update on public.meal_plans
for each row execute function public.set_updated_at();

-- Keep the meal name when a recipe is deleted; the FK then clears recipe_id.
create or replace function public.preserve_meal_plan_recipe_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.meal_plans
  set title = old.name
  where recipe_id = old.id and user_id = old.user_id and title is null;
  return old;
end;
$$;

revoke all on function public.preserve_meal_plan_recipe_name() from public;
grant execute on function public.preserve_meal_plan_recipe_name() to authenticated;

create trigger recipes_preserve_meal_plan_name before delete on public.recipes
for each row execute function public.preserve_meal_plan_recipe_name();

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  meal_type public.meal_type not null,
  food_name text not null check (length(trim(food_name)) > 0),
  quantity numeric(10, 3) not null default 1 check (quantity > 0),
  unit text not null default 'ud',
  calories numeric(10, 2) check (calories is null or calories >= 0),
  protein_g numeric(10, 2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(10, 2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(10, 2) check (fat_g is null or fat_g >= 0),
  notes text,
  meal_plan_id uuid references public.meal_plans(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  created_at timestamptz not null default now()
);

create index food_logs_user_date_idx on public.food_logs(user_id, log_date);

-- PRIORITY FOODS ------------------------------------------------------------
create table public.priority_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text,
  unit text not null default 'ud',
  period public.frequency_period not null default 'weekly',
  target_count integer not null check (target_count > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create trigger priority_foods_updated_at before update on public.priority_foods
for each row execute function public.set_updated_at();

create table public.priority_food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  priority_food_id uuid not null,
  logged_on date not null default current_date,
  quantity numeric(10, 3) not null default 1 check (quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (priority_food_id, logged_on),
  foreign key (priority_food_id, user_id) references public.priority_foods(id, user_id) on delete cascade
);

create index priority_food_logs_user_date_idx on public.priority_food_logs(user_id, logged_on);

-- PANTRY --------------------------------------------------------------------
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text,
  location text,
  quantity numeric(12, 3) not null default 0 check (quantity >= 0),
  unit text not null default 'ud',
  min_quantity numeric(12, 3) not null default 0 check (min_quantity >= 0),
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name, unit)
);

create index pantry_items_user_quantity_idx on public.pantry_items(user_id, quantity);

create trigger pantry_items_updated_at before update on public.pantry_items
for each row execute function public.set_updated_at();

create table public.pantry_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pantry_item_id uuid not null,
  delta numeric(12, 3) not null,
  reason public.pantry_reason not null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (pantry_item_id, user_id) references public.pantry_items(id, user_id) on delete cascade
);

create index pantry_transactions_user_date_idx on public.pantry_transactions(user_id, created_at desc);

-- SHOPPING ------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mercado',
  status public.shopping_status not null default 'open',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create trigger shopping_lists_updated_at before update on public.shopping_lists
for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  category text,
  quantity numeric(10, 3) not null default 1 check (quantity > 0),
  unit text not null default 'ud',
  estimated_price numeric(10, 2) check (estimated_price is null or estimated_price >= 0),
  actual_price numeric(10, 2) check (actual_price is null or actual_price >= 0),
  is_checked boolean not null default false,
  pantry_item_id uuid references public.pantry_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (list_id, user_id) references public.shopping_lists(id, user_id) on delete cascade
);

create unique index shopping_list_items_unique_name_idx
  on public.shopping_list_items(list_id, lower(name), unit);

create trigger shopping_list_items_updated_at before update on public.shopping_list_items
for each row execute function public.set_updated_at();

-- TRAINING ------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  muscle_group text,
  exercise_type public.workout_type not null default 'strength' check (exercise_type <> 'rest'),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index exercises_unique_name_idx on public.exercises(user_id, lower(name));

create table public.workout_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  title text not null default 'Descanso',
  workout_type public.workout_type not null default 'rest',
  muscle_groups text[] not null default '{}',
  is_rest boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, weekday)
);

create trigger workout_routines_updated_at before update on public.workout_routines
for each row execute function public.set_updated_at();

create table public.routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null,
  exercise_id uuid not null,
  position integer not null default 0,
  sets integer check (sets is null or sets > 0),
  reps integer check (reps is null or reps > 0),
  distance_m numeric(10, 2) check (distance_m is null or distance_m >= 0),
  duration_min numeric(10, 2) check (duration_min is null or duration_min >= 0),
  notes text,
  foreign key (routine_id, user_id) references public.workout_routines(id, user_id) on delete cascade,
  foreign key (exercise_id, user_id) references public.exercises(id, user_id) on delete cascade
);

create index routine_items_routine_idx on public.routine_items(routine_id, position);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null default current_date,
  started_at timestamptz,
  duration_min integer not null default 0 check (duration_min >= 0),
  workout_type public.workout_type not null default 'strength' check (workout_type <> 'rest'),
  status public.session_status not null default 'completed',
  notes text,
  routine_id uuid references public.workout_routines(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index workout_sessions_user_date_idx on public.workout_sessions(user_id, session_date desc);

create trigger workout_sessions_updated_at before update on public.workout_sessions
for each row execute function public.set_updated_at();

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null check (length(trim(exercise_name)) > 0),
  muscle_group text,
  sets integer check (sets is null or sets > 0),
  reps integer check (reps is null or reps > 0),
  weight_kg numeric(10, 2) check (weight_kg is null or weight_kg >= 0),
  distance_m numeric(10, 2) check (distance_m is null or distance_m >= 0),
  duration_sec integer check (duration_sec is null or duration_sec >= 0),
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions(id, user_id) on delete cascade
);

create index exercise_logs_session_idx on public.exercise_logs(session_id, position);
create index exercise_logs_exercise_idx on public.exercise_logs(user_id, exercise_id, created_at);

-- PROFILE BOOTSTRAP ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;

  insert into public.categories (user_id, kind, name) values
    (new.id, 'activity', 'Personal'),
    (new.id, 'activity', 'Trabajo'),
    (new.id, 'activity', 'Salud'),
    (new.id, 'task', 'Personal'),
    (new.id, 'task', 'Trabajo'),
    (new.id, 'task', 'Casa'),
    (new.id, 'recipe', 'Desayuno'),
    (new.id, 'recipe', 'Comida'),
    (new.id, 'recipe', 'Cena'),
    (new.id, 'recipe', 'Snack')
  on conflict (user_id, kind, name) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ROW LEVEL SECURITY --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.goals enable row level security;
alter table public.goal_progress enable row level security;
alter table public.goal_task_links enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plans enable row level security;
alter table public.food_logs enable row level security;
alter table public.priority_foods enable row level security;
alter table public.priority_food_logs enable row level security;
alter table public.pantry_items enable row level security;
alter table public.pantry_transactions enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_routines enable row level security;
alter table public.routine_items enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_logs enable row level security;

create policy "profiles_select_own" on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles for delete using ((select auth.uid()) = id);

do $$
declare
  table_name text;
  tables text[] := array[
    'categories', 'activities', 'tasks', 'notes', 'goals', 'goal_progress',
    'goal_task_links', 'recipes', 'recipe_ingredients', 'meal_plans', 'food_logs',
    'priority_foods', 'priority_food_logs', 'pantry_items', 'pantry_transactions',
    'shopping_lists', 'shopping_list_items', 'exercises', 'workout_routines',
    'routine_items', 'workout_sessions', 'exercise_logs'
  ];
begin
  foreach table_name in array tables loop
    execute format('create policy "own_select" on public.%I for select using ((select auth.uid()) = user_id)', table_name);
    execute format('create policy "own_insert" on public.%I for insert with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy "own_update" on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy "own_delete" on public.%I for delete using ((select auth.uid()) = user_id)', table_name);
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ATOMIC SHOPPING COMPLETION ------------------------------------------------
-- Locks the list, prevents double completion, adds checked products to pantry
-- and writes an audit transaction for every stock movement.
create or replace function public.complete_shopping_list(p_list_id uuid, p_update_pantry boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_list public.shopping_lists%rowtype;
  v_item public.shopping_list_items%rowtype;
  v_pantry_id uuid;
  v_total numeric := 0;
  v_items integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_list
  from public.shopping_lists
  where id = p_list_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Lista no encontrada';
  end if;

  if v_list.status = 'completed' then
    raise exception 'La compra ya fue completada';
  end if;

  for v_item in
    select * from public.shopping_list_items
    where list_id = p_list_id and user_id = v_user_id and is_checked = true
    for update
  loop
    v_total := v_total + (coalesce(v_item.actual_price, v_item.estimated_price, 0) * v_item.quantity);
    v_items := v_items + 1;

    if p_update_pantry then
      if v_item.pantry_item_id is not null then
        update public.pantry_items
          set quantity = quantity + v_item.quantity
          where id = v_item.pantry_item_id and user_id = v_user_id
          returning id into v_pantry_id;
      end if;

      if v_pantry_id is null then
        insert into public.pantry_items (user_id, name, category, quantity, unit)
        values (v_user_id, v_item.name, v_item.category, v_item.quantity, v_item.unit)
        on conflict (user_id, name, unit) do update
          set quantity = public.pantry_items.quantity + excluded.quantity
        returning id into v_pantry_id;
      end if;

      insert into public.pantry_transactions (user_id, pantry_item_id, delta, reason, note)
      values (v_user_id, v_pantry_id, v_item.quantity, 'purchase', 'Compra: ' || v_list.name);
    end if;

    v_pantry_id := null;
  end loop;

  update public.shopping_lists
  set status = 'completed', completed_at = now()
  where id = p_list_id and user_id = v_user_id;

  return jsonb_build_object(
    'list_id', p_list_id,
    'items_added', v_items,
    'total', round(v_total, 2),
    'pantry_updated', p_update_pantry
  );
end;
$$;

revoke all on function public.complete_shopping_list(uuid, boolean) from public;
grant execute on function public.complete_shopping_list(uuid, boolean) to authenticated;

-- ATOMIC PANTRY ADJUSTMENT ---------------------------------------------------
create or replace function public.adjust_pantry_quantity(
  p_item_id uuid,
  p_delta numeric,
  p_reason public.pantry_reason,
  p_note text default null
)
returns public.pantry_items
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.pantry_items%rowtype;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  if p_delta = 0 then
    raise exception 'El ajuste debe ser distinto de cero';
  end if;

  select * into v_item
  from public.pantry_items
  where id = p_item_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Alimento no encontrado';
  end if;

  if v_item.quantity + p_delta < 0 then
    raise exception 'La cantidad no puede ser negativa';
  end if;

  update public.pantry_items
  set quantity = quantity + p_delta
  where id = p_item_id and user_id = v_user_id
  returning * into v_item;

  insert into public.pantry_transactions (user_id, pantry_item_id, delta, reason, note)
  values (v_user_id, p_item_id, p_delta, p_reason, p_note);

  return v_item;
end;
$$;

revoke all on function public.adjust_pantry_quantity(uuid, numeric, public.pantry_reason, text) from public;
grant execute on function public.adjust_pantry_quantity(uuid, numeric, public.pantry_reason, text) to authenticated;

-- CONSUME A PLANNED MEAL ONCE -------------------------------------------------
create or replace function public.consume_meal_plan(p_meal_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.meal_plans%rowtype;
  v_recipe_name text;
  v_food_log_id uuid;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_plan
  from public.meal_plans
  where id = p_meal_plan_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Comida planificada no encontrada';
  end if;

  if v_plan.is_consumed then
    raise exception 'Esta comida ya está registrada como consumida';
  end if;

  if v_plan.recipe_id is not null then
    select name into v_recipe_name from public.recipes where id = v_plan.recipe_id and user_id = v_user_id;
  end if;

  insert into public.food_logs (
    user_id, log_date, meal_type, food_name, quantity, unit, notes, meal_plan_id, recipe_id
  ) values (
    v_user_id,
    v_plan.plan_date,
    v_plan.meal_type,
    coalesce(v_recipe_name, v_plan.title, 'Comida'),
    v_plan.servings,
    'ración',
    'Registrado desde el planificador',
    v_plan.id,
    v_plan.recipe_id
  )
  returning id into v_food_log_id;

  update public.meal_plans
  set is_consumed = true, consumed_at = now()
  where id = v_plan.id and user_id = v_user_id;

  return v_food_log_id;
end;
$$;

revoke all on function public.consume_meal_plan(uuid) from public;
grant execute on function public.consume_meal_plan(uuid) to authenticated;

-- SAVE A WORKOUT SESSION AND ITS EXERCISES ATOMICALLY -------------------------
create or replace function public.save_workout_session(
  p_session_date date,
  p_workout_type public.workout_type,
  p_duration_min integer,
  p_status public.session_status,
  p_notes text default null,
  p_started_at timestamptz default null,
  p_routine_id uuid default null,
  p_logs jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_log jsonb;
  v_exercise_id uuid;
  v_position integer := 0;
  v_routine_id uuid := p_routine_id;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if v_routine_id is not null then
    if not exists (select 1 from public.workout_routines where id = v_routine_id and user_id = v_user_id) then
      v_routine_id := null;
    end if;
  end if;

  insert into public.workout_sessions (
    user_id, session_date, started_at, duration_min, workout_type, status, notes, routine_id
  ) values (
    v_user_id, p_session_date, p_started_at, greatest(0, coalesce(p_duration_min, 0)),
    p_workout_type, p_status, p_notes, v_routine_id
  )
  returning id into v_session_id;

  for v_log in select * from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb))
  loop
    v_position := v_position + 1;
    v_exercise_id := nullif(v_log ->> 'exercise_id', '')::uuid;

    if v_exercise_id is not null then
      if not exists (select 1 from public.exercises where id = v_exercise_id and user_id = v_user_id) then
        v_exercise_id := null;
      end if;
    end if;

    if length(trim(coalesce(v_log ->> 'exercise_name', ''))) = 0 then
      continue;
    end if;

    insert into public.exercise_logs (
      user_id, session_id, exercise_id, exercise_name, muscle_group, sets, reps,
      weight_kg, distance_m, duration_sec, notes, position
    ) values (
      v_user_id,
      v_session_id,
      v_exercise_id,
      trim(v_log ->> 'exercise_name'),
      nullif(v_log ->> 'muscle_group', ''),
      nullif(v_log ->> 'sets', '')::integer,
      nullif(v_log ->> 'reps', '')::integer,
      nullif(v_log ->> 'weight_kg', '')::numeric,
      nullif(v_log ->> 'distance_m', '')::numeric,
      nullif(v_log ->> 'duration_sec', '')::integer,
      nullif(v_log ->> 'notes', ''),
      coalesce(nullif(v_log ->> 'position', '')::integer, v_position)
    );
  end loop;

  return v_session_id;
end;
$$;

revoke all on function public.save_workout_session(date, public.workout_type, integer, public.session_status, text, timestamptz, uuid, jsonb) from public;
grant execute on function public.save_workout_session(date, public.workout_type, integer, public.session_status, text, timestamptz, uuid, jsonb) to authenticated;

-- ADD SHOPPING ITEMS WITH CASE-INSENSITIVE DEDUPLICATION ----------------------
create or replace function public.add_shopping_items(p_list_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_list public.shopping_lists%rowtype;
  v_item jsonb;
  v_name text;
  v_unit text;
  v_quantity numeric;
  v_existing_id uuid;
  v_added integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_list
  from public.shopping_lists
  where id = p_list_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Lista no encontrada';
  end if;
  if v_list.status = 'completed' then
    raise exception 'La lista ya está completada';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_name := trim(coalesce(v_item ->> 'name', ''));
    if length(v_name) = 0 then
      continue;
    end if;
    v_unit := coalesce(nullif(v_item ->> 'unit', ''), 'ud');
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    if v_quantity <= 0 then
      continue;
    end if;

    select id into v_existing_id
    from public.shopping_list_items
    where list_id = p_list_id
      and user_id = v_user_id
      and lower(name) = lower(v_name)
      and unit = v_unit
    limit 1
    for update;

    if v_existing_id is not null then
      update public.shopping_list_items
      set quantity = quantity + v_quantity,
          estimated_price = coalesce(estimated_price, nullif(v_item ->> 'estimated_price', '')::numeric),
          category = coalesce(category, nullif(v_item ->> 'category', ''))
      where id = v_existing_id and user_id = v_user_id;
    else
      insert into public.shopping_list_items (
        user_id, list_id, name, category, quantity, unit, estimated_price
      ) values (
        v_user_id, p_list_id, v_name, nullif(v_item ->> 'category', ''), v_quantity, v_unit,
        nullif(v_item ->> 'estimated_price', '')::numeric
      );
    end if;
    v_added := v_added + 1;
  end loop;

  return v_added;
end;
$$;

revoke all on function public.add_shopping_items(uuid, jsonb) from public;
grant execute on function public.add_shopping_items(uuid, jsonb) to authenticated;

-- SAVE A RECIPE AND ITS INGREDIENTS ATOMICALLY --------------------------------
create or replace function public.save_recipe(
  p_recipe_id uuid,
  p_recipe jsonb,
  p_ingredients jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipe_id uuid := p_recipe_id;
  v_name text := trim(coalesce(p_recipe ->> 'name', ''));
  v_ingredient jsonb;
  v_position integer := 0;
  v_tags text[] := array(select jsonb_array_elements_text(coalesce(p_recipe -> 'tags', '[]'::jsonb)));
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  if length(v_name) = 0 then
    raise exception 'El nombre de la receta es obligatorio';
  end if;

  if v_recipe_id is null then
    insert into public.recipes (
      user_id, name, description, instructions, prep_minutes, servings, category_id, is_favorite, tags
    ) values (
      v_user_id,
      v_name,
      nullif(p_recipe ->> 'description', ''),
      coalesce(p_recipe ->> 'instructions', ''),
      nullif(p_recipe ->> 'prep_minutes', '')::integer,
      coalesce(nullif(p_recipe ->> 'servings', '')::numeric, 1),
      nullif(p_recipe ->> 'category_id', '')::uuid,
      coalesce((p_recipe ->> 'is_favorite')::boolean, false),
      v_tags
    )
    returning id into v_recipe_id;
  else
    update public.recipes
    set name = v_name,
        description = nullif(p_recipe ->> 'description', ''),
        instructions = coalesce(p_recipe ->> 'instructions', ''),
        prep_minutes = nullif(p_recipe ->> 'prep_minutes', '')::integer,
        servings = coalesce(nullif(p_recipe ->> 'servings', '')::numeric, 1),
        category_id = nullif(p_recipe ->> 'category_id', '')::uuid,
        is_favorite = coalesce((p_recipe ->> 'is_favorite')::boolean, false),
        tags = v_tags
    where id = v_recipe_id and user_id = v_user_id;

    if not found then
      raise exception 'Receta no encontrada';
    end if;

    delete from public.recipe_ingredients where recipe_id = v_recipe_id and user_id = v_user_id;
  end if;

  for v_ingredient in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    if length(trim(coalesce(v_ingredient ->> 'name', ''))) = 0 then
      continue;
    end if;
    if coalesce(nullif(v_ingredient ->> 'quantity', '')::numeric, 0) <= 0 then
      continue;
    end if;
    v_position := v_position + 1;
    insert into public.recipe_ingredients (user_id, recipe_id, name, quantity, unit, notes, position)
    values (
      v_user_id,
      v_recipe_id,
      trim(v_ingredient ->> 'name'),
      (v_ingredient ->> 'quantity')::numeric,
      coalesce(nullif(v_ingredient ->> 'unit', ''), 'ud'),
      nullif(v_ingredient ->> 'notes', ''),
      v_position
    );
  end loop;

  return v_recipe_id;
end;
$$;

revoke all on function public.save_recipe(uuid, jsonb, jsonb) from public;
grant execute on function public.save_recipe(uuid, jsonb, jsonb) to authenticated;

-- UNDO A PLANNED MEAL CONSUMPTION --------------------------------------------
create or replace function public.unconsume_meal_plan(p_meal_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.meal_plans%rowtype;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_plan
  from public.meal_plans
  where id = p_meal_plan_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Comida planificada no encontrada';
  end if;
  if not v_plan.is_consumed then
    raise exception 'Esta comida no está marcada como consumida';
  end if;

  delete from public.food_logs
  where meal_plan_id = p_meal_plan_id
    and user_id = v_user_id
    and notes = 'Registrado desde el planificador';

  update public.meal_plans
  set is_consumed = false, consumed_at = null
  where id = p_meal_plan_id and user_id = v_user_id;
end;
$$;

revoke all on function public.unconsume_meal_plan(uuid) from public;
grant execute on function public.unconsume_meal_plan(uuid) to authenticated;

create unique index shopping_lists_one_open_idx
  on public.shopping_lists(user_id) where status = 'open';

-- SAVE A WEEKLY ROUTINE AND ITS EXERCISES ATOMICALLY --------------------------
create or replace function public.save_workout_routine(
  p_routine_id uuid,
  p_weekday integer,
  p_routine jsonb,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_routine_id uuid := p_routine_id;
  v_item jsonb;
  v_position integer := 0;
  v_exercise_id uuid;
  v_muscles text[] := array(select jsonb_array_elements_text(coalesce(p_routine -> 'muscle_groups', '[]'::jsonb)));
  v_rest boolean := coalesce((p_routine ->> 'is_rest')::boolean, false);
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  if p_weekday < 0 or p_weekday > 6 then
    raise exception 'Día de la semana no válido';
  end if;

  if v_routine_id is null then
    insert into public.workout_routines (
      user_id, weekday, title, workout_type, muscle_groups, is_rest, notes
    ) values (
      v_user_id,
      p_weekday,
      coalesce(nullif(p_routine ->> 'title', ''), 'Descanso'),
      case when v_rest then 'rest'::public.workout_type else coalesce(nullif(p_routine ->> 'workout_type', ''), 'strength')::public.workout_type end,
      v_muscles,
      v_rest,
      nullif(p_routine ->> 'notes', '')
    )
    on conflict (user_id, weekday) do update
      set title = excluded.title,
          workout_type = excluded.workout_type,
          muscle_groups = excluded.muscle_groups,
          is_rest = excluded.is_rest,
          notes = excluded.notes
    returning id into v_routine_id;
  else
    update public.workout_routines
    set weekday = p_weekday,
        title = coalesce(nullif(p_routine ->> 'title', ''), 'Descanso'),
        workout_type = case when v_rest then 'rest'::public.workout_type else coalesce(nullif(p_routine ->> 'workout_type', ''), 'strength')::public.workout_type end,
        muscle_groups = v_muscles,
        is_rest = v_rest,
        notes = nullif(p_routine ->> 'notes', '')
    where id = v_routine_id and user_id = v_user_id;

    if not found then
      raise exception 'Rutina no encontrada';
    end if;

    delete from public.routine_items where routine_id = v_routine_id and user_id = v_user_id;
  end if;

  if p_routine_id is null then
    delete from public.routine_items where routine_id = v_routine_id and user_id = v_user_id;
  end if;

  if not v_rest then
    for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    loop
      v_exercise_id := nullif(v_item ->> 'exercise_id', '')::uuid;
      if v_exercise_id is null then
        continue;
      end if;
      if not exists (select 1 from public.exercises where id = v_exercise_id and user_id = v_user_id) then
        continue;
      end if;
      v_position := v_position + 1;
      insert into public.routine_items (
        user_id, routine_id, exercise_id, position, sets, reps, distance_m, duration_min, notes
      ) values (
        v_user_id,
        v_routine_id,
        v_exercise_id,
        v_position,
        nullif(v_item ->> 'sets', '')::integer,
        nullif(v_item ->> 'reps', '')::integer,
        nullif(v_item ->> 'distance_m', '')::numeric,
        nullif(v_item ->> 'duration_min', '')::numeric,
        nullif(v_item ->> 'notes', '')
      );
    end loop;
  end if;

  return v_routine_id;
end;
$$;

revoke all on function public.save_workout_routine(uuid, integer, jsonb, jsonb) from public;
grant execute on function public.save_workout_routine(uuid, integer, jsonb, jsonb) to authenticated;

-- SAVE A GOAL AND ITS TASK LINKS ATOMICALLY -----------------------------------
create or replace function public.save_goal(
  p_goal_id uuid,
  p_goal jsonb,
  p_task_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid := p_goal_id;
  v_task_id uuid;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  if length(trim(coalesce(p_goal ->> 'title', ''))) = 0 then
    raise exception 'El título del objetivo es obligatorio';
  end if;
  if coalesce(nullif(p_goal ->> 'target_value', '')::numeric, 0) <= 0 then
    raise exception 'La meta debe ser mayor que cero';
  end if;

  if v_goal_id is null then
    insert into public.goals (
      user_id, title, description, period, metric_unit, target_value, start_date, end_date, status, category_id
    ) values (
      v_user_id,
      trim(p_goal ->> 'title'),
      nullif(p_goal ->> 'description', ''),
      coalesce(nullif(p_goal ->> 'period', ''), 'weekly')::public.goal_period,
      coalesce(nullif(p_goal ->> 'metric_unit', ''), 'acciones'),
      (p_goal ->> 'target_value')::numeric,
      coalesce(nullif(p_goal ->> 'start_date', '')::date, current_date),
      nullif(p_goal ->> 'end_date', '')::date,
      coalesce(nullif(p_goal ->> 'status', ''), 'active')::public.goal_status,
      nullif(p_goal ->> 'category_id', '')::uuid
    )
    returning id into v_goal_id;
  else
    update public.goals
    set title = trim(p_goal ->> 'title'),
        description = nullif(p_goal ->> 'description', ''),
        period = coalesce(nullif(p_goal ->> 'period', ''), 'weekly')::public.goal_period,
        metric_unit = coalesce(nullif(p_goal ->> 'metric_unit', ''), 'acciones'),
        target_value = (p_goal ->> 'target_value')::numeric,
        start_date = coalesce(nullif(p_goal ->> 'start_date', '')::date, current_date),
        end_date = nullif(p_goal ->> 'end_date', '')::date,
        status = coalesce(nullif(p_goal ->> 'status', ''), 'active')::public.goal_status,
        category_id = nullif(p_goal ->> 'category_id', '')::uuid
    where id = v_goal_id and user_id = v_user_id;

    if not found then
      raise exception 'Objetivo no encontrado';
    end if;

    delete from public.goal_task_links where goal_id = v_goal_id and user_id = v_user_id;
  end if;

  if p_task_ids is not null then
    foreach v_task_id in array p_task_ids loop
      if exists (select 1 from public.tasks where id = v_task_id and user_id = v_user_id) then
        insert into public.goal_task_links (user_id, goal_id, task_id)
        values (v_user_id, v_goal_id, v_task_id)
        on conflict (goal_id, task_id) do nothing;
      end if;
    end loop;
  end if;

  return v_goal_id;
end;
$$;

revoke all on function public.save_goal(uuid, jsonb, uuid[]) from public;
grant execute on function public.save_goal(uuid, jsonb, uuid[]) to authenticated;

-- ============================================================
-- 0002_food_catalog.sql
-- ============================================================

-- FOOD CATALOG & NUTRITION ---------------------------------------------------
-- Every recipe ingredient points to a registered food. Nutrition is stored per
-- 100 g or 100 ml so portions and recipes can be scaled consistently.

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  brand text,
  category text,
  nutrition_unit text not null default 'g' check (nutrition_unit in ('g', 'ml')),
  reference_amount numeric(10, 3) not null default 100 check (reference_amount > 0),
  calories numeric(10, 2) check (calories is null or calories >= 0),
  protein_g numeric(10, 2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(10, 2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(10, 2) check (fat_g is null or fat_g >= 0),
  fiber_g numeric(10, 2) check (fiber_g is null or fiber_g >= 0),
  grams_per_unit numeric(10, 3) check (grams_per_unit is null or grams_per_unit > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create index foods_user_name_idx on public.foods(user_id, lower(name));
create index foods_user_category_idx on public.foods(user_id, category);

create trigger foods_updated_at before update on public.foods
for each row execute function public.set_updated_at();

alter table public.foods enable row level security;

create policy "own_select" on public.foods for select using ((select auth.uid()) = user_id);
create policy "own_insert" on public.foods for insert with check ((select auth.uid()) = user_id);
create policy "own_update" on public.foods for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own_delete" on public.foods for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.foods to authenticated;

-- LINK RECIPE INGREDIENTS TO THE CATALOG -------------------------------------
alter table public.recipe_ingredients add column food_id uuid;
alter table public.food_logs add column food_id uuid;
alter table public.food_logs add column fiber_g numeric(10, 2) check (fiber_g is null or fiber_g >= 0);

-- Backfill existing free-text ingredients so no recipe is lost.
insert into public.foods (user_id, name, category, nutrition_unit)
select distinct
  ri.user_id,
  trim(ri.name),
  null,
  case when lower(ri.unit) in ('ml', 'l') then 'ml' else 'g' end
from public.recipe_ingredients ri
where length(trim(ri.name)) > 0
on conflict (user_id, name) do nothing;

update public.recipe_ingredients ri
set food_id = f.id
from public.foods f
where f.user_id = ri.user_id
  and f.name = trim(ri.name)
  and ri.food_id is null;

alter table public.recipe_ingredients alter column food_id set not null;

alter table public.recipe_ingredients
  add constraint recipe_ingredients_food_fk
  foreign key (food_id, user_id) references public.foods(id, user_id) on delete restrict;

alter table public.food_logs
  add constraint food_logs_food_fk
  foreign key (food_id, user_id) references public.foods(id, user_id) on delete set null (food_id);

create index recipe_ingredients_food_idx on public.recipe_ingredients(food_id);
create index food_logs_food_idx on public.food_logs(food_id);

-- SAVE A RECIPE AND ITS INGREDIENTS ATOMICALLY --------------------------------
-- Existing signature is kept; ingredients now require a registered food.
create or replace function public.save_recipe(
  p_recipe_id uuid,
  p_recipe jsonb,
  p_ingredients jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipe_id uuid := p_recipe_id;
  v_name text := trim(coalesce(p_recipe ->> 'name', ''));
  v_ingredient jsonb;
  v_food_id uuid;
  v_food_name text;
  v_position integer := 0;
  v_tags text[] := array(select jsonb_array_elements_text(coalesce(p_recipe -> 'tags', '[]'::jsonb)));
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  if length(v_name) = 0 then
    raise exception 'El nombre de la receta es obligatorio';
  end if;

  if v_recipe_id is null then
    insert into public.recipes (
      user_id, name, description, instructions, prep_minutes, servings, category_id, is_favorite, tags
    ) values (
      v_user_id,
      v_name,
      nullif(p_recipe ->> 'description', ''),
      coalesce(p_recipe ->> 'instructions', ''),
      nullif(p_recipe ->> 'prep_minutes', '')::integer,
      coalesce(nullif(p_recipe ->> 'servings', '')::numeric, 1),
      nullif(p_recipe ->> 'category_id', '')::uuid,
      coalesce((p_recipe ->> 'is_favorite')::boolean, false),
      v_tags
    )
    returning id into v_recipe_id;
  else
    update public.recipes
    set name = v_name,
        description = nullif(p_recipe ->> 'description', ''),
        instructions = coalesce(p_recipe ->> 'instructions', ''),
        prep_minutes = nullif(p_recipe ->> 'prep_minutes', '')::integer,
        servings = coalesce(nullif(p_recipe ->> 'servings', '')::numeric, 1),
        category_id = nullif(p_recipe ->> 'category_id', '')::uuid,
        is_favorite = coalesce((p_recipe ->> 'is_favorite')::boolean, false),
        tags = v_tags
    where id = v_recipe_id and user_id = v_user_id;

    if not found then
      raise exception 'Receta no encontrada';
    end if;

    delete from public.recipe_ingredients where recipe_id = v_recipe_id and user_id = v_user_id;
  end if;

  for v_ingredient in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    v_food_id := nullif(v_ingredient ->> 'food_id', '')::uuid;

    if v_food_id is null then
      raise exception 'Cada ingrediente debe ser un alimento registrado';
    end if;
    if coalesce(nullif(v_ingredient ->> 'quantity', '')::numeric, 0) <= 0 then
      continue;
    end if;

    select name into v_food_name
    from public.foods
    where id = v_food_id and user_id = v_user_id;

    if not found then
      raise exception 'Alimento no encontrado';
    end if;

    v_position := v_position + 1;
    insert into public.recipe_ingredients (user_id, recipe_id, food_id, name, quantity, unit, notes, position)
    values (
      v_user_id,
      v_recipe_id,
      v_food_id,
      v_food_name,
      (v_ingredient ->> 'quantity')::numeric,
      coalesce(nullif(v_ingredient ->> 'unit', ''), 'ud'),
      nullif(v_ingredient ->> 'notes', ''),
      v_position
    );
  end loop;

  return v_recipe_id;
end;
$$;

revoke all on function public.save_recipe(uuid, jsonb, jsonb) from public;
grant execute on function public.save_recipe(uuid, jsonb, jsonb) to authenticated;

-- CONSUME A PLANNED MEAL ONCE -------------------------------------------------
-- The generated food log now carries the recipe's nutrition for the portions
-- actually eaten. Free-text meals keep their macros empty.
create or replace function public.consume_meal_plan(p_meal_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.meal_plans%rowtype;
  v_recipe_name text;
  v_recipe_servings numeric;
  v_food_log_id uuid;
  v_ratio numeric := 1;
  v_calories numeric;
  v_protein numeric;
  v_carbs numeric;
  v_fat numeric;
  v_fiber numeric;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_plan
  from public.meal_plans
  where id = p_meal_plan_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Comida planificada no encontrada';
  end if;

  if v_plan.is_consumed then
    raise exception 'Esta comida ya está registrada como consumida';
  end if;

  if v_plan.recipe_id is not null then
    select name, servings into v_recipe_name, v_recipe_servings
    from public.recipes
    where id = v_plan.recipe_id and user_id = v_user_id;

    if v_recipe_servings is not null and v_recipe_servings > 0 then
      v_ratio := v_plan.servings / v_recipe_servings;

      select
        coalesce(sum(coalesce(f.calories, 0) * case
          when ri.unit = f.nutrition_unit then ri.quantity / f.reference_amount
          when ri.unit = 'kg' and f.nutrition_unit = 'g' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'l' and f.nutrition_unit = 'ml' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'ud' and f.grams_per_unit is not null then ri.quantity * f.grams_per_unit / f.reference_amount
          else 0 end), 0),
        coalesce(sum(coalesce(f.protein_g, 0) * case
          when ri.unit = f.nutrition_unit then ri.quantity / f.reference_amount
          when ri.unit = 'kg' and f.nutrition_unit = 'g' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'l' and f.nutrition_unit = 'ml' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'ud' and f.grams_per_unit is not null then ri.quantity * f.grams_per_unit / f.reference_amount
          else 0 end), 0),
        coalesce(sum(coalesce(f.carbs_g, 0) * case
          when ri.unit = f.nutrition_unit then ri.quantity / f.reference_amount
          when ri.unit = 'kg' and f.nutrition_unit = 'g' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'l' and f.nutrition_unit = 'ml' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'ud' and f.grams_per_unit is not null then ri.quantity * f.grams_per_unit / f.reference_amount
          else 0 end), 0),
        coalesce(sum(coalesce(f.fat_g, 0) * case
          when ri.unit = f.nutrition_unit then ri.quantity / f.reference_amount
          when ri.unit = 'kg' and f.nutrition_unit = 'g' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'l' and f.nutrition_unit = 'ml' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'ud' and f.grams_per_unit is not null then ri.quantity * f.grams_per_unit / f.reference_amount
          else 0 end), 0),
        coalesce(sum(coalesce(f.fiber_g, 0) * case
          when ri.unit = f.nutrition_unit then ri.quantity / f.reference_amount
          when ri.unit = 'kg' and f.nutrition_unit = 'g' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'l' and f.nutrition_unit = 'ml' then ri.quantity * 1000 / f.reference_amount
          when ri.unit = 'ud' and f.grams_per_unit is not null then ri.quantity * f.grams_per_unit / f.reference_amount
          else 0 end), 0)
      into v_calories, v_protein, v_carbs, v_fat, v_fiber
      from public.recipe_ingredients ri
      join public.foods f on f.id = ri.food_id and f.user_id = ri.user_id
      where ri.recipe_id = v_plan.recipe_id and ri.user_id = v_user_id;

      v_calories := round(v_calories * v_ratio, 2);
      v_protein := round(v_protein * v_ratio, 2);
      v_carbs := round(v_carbs * v_ratio, 2);
      v_fat := round(v_fat * v_ratio, 2);
      v_fiber := round(v_fiber * v_ratio, 2);
    end if;
  end if;

  insert into public.food_logs (
    user_id, log_date, meal_type, food_name, quantity, unit, notes,
    meal_plan_id, recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g
  ) values (
    v_user_id,
    v_plan.plan_date,
    v_plan.meal_type,
    coalesce(v_recipe_name, v_plan.title, 'Comida'),
    v_plan.servings,
    'ración',
    'Registrado desde el planificador',
    v_plan.id,
    v_plan.recipe_id,
    v_calories,
    v_protein,
    v_carbs,
    v_fat,
    v_fiber
  )
  returning id into v_food_log_id;

  update public.meal_plans
  set is_consumed = true, consumed_at = now()
  where id = v_plan.id and user_id = v_user_id;

  return v_food_log_id;
end;
$$;

revoke all on function public.consume_meal_plan(uuid) from public;
grant execute on function public.consume_meal_plan(uuid) to authenticated;

-- ============================================================
-- 0003_food_prices.sql
-- ============================================================

alter table public.foods
  add column price numeric(12, 2) check (price is null or price >= 0);

-- ============================================================
-- 0004_market_totals_and_reuse.sql
-- ============================================================

create or replace function public.complete_shopping_list(p_list_id uuid, p_update_pantry boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_list public.shopping_lists%rowtype;
  v_item public.shopping_list_items%rowtype;
  v_pantry_id uuid;
  v_total numeric := 0;
  v_items integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_list
  from public.shopping_lists
  where id = p_list_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Lista no encontrada';
  end if;

  if v_list.status = 'completed' then
    raise exception 'La compra ya fue completada';
  end if;

  for v_item in
    select * from public.shopping_list_items
    where list_id = p_list_id and user_id = v_user_id and is_checked = true
    for update
  loop
    v_total := v_total + coalesce(v_item.actual_price, v_item.estimated_price, 0);
    v_items := v_items + 1;

    if p_update_pantry then
      if v_item.pantry_item_id is not null then
        update public.pantry_items
          set quantity = quantity + v_item.quantity
          where id = v_item.pantry_item_id and user_id = v_user_id
          returning id into v_pantry_id;
      end if;

      if v_pantry_id is null then
        insert into public.pantry_items (user_id, name, category, quantity, unit)
        values (v_user_id, v_item.name, v_item.category, v_item.quantity, v_item.unit)
        on conflict (user_id, name, unit) do update
          set quantity = public.pantry_items.quantity + excluded.quantity
        returning id into v_pantry_id;
      end if;

      insert into public.pantry_transactions (user_id, pantry_item_id, delta, reason, note)
      values (v_user_id, v_pantry_id, v_item.quantity, 'purchase', 'Compra: ' || v_list.name);
    end if;

    v_pantry_id := null;
  end loop;

  update public.shopping_lists
  set status = 'completed', completed_at = now()
  where id = p_list_id and user_id = v_user_id;

  return jsonb_build_object(
    'list_id', p_list_id,
    'items_added', v_items,
    'total', round(v_total, 2),
    'pantry_updated', p_update_pantry
  );
end;
$$;

revoke all on function public.complete_shopping_list(uuid, boolean) from public;
grant execute on function public.complete_shopping_list(uuid, boolean) to authenticated;

create or replace function public.reuse_shopping_list(p_source_list_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.shopping_lists%rowtype;
  v_new_list_id uuid;
  v_open_list_id uuid;
  v_items integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_source
  from public.shopping_lists
  where id = p_source_list_id and user_id = v_user_id;

  if not found then
    raise exception 'Lista no encontrada';
  end if;

  if v_source.status <> 'completed' then
    raise exception 'Solo puedes reutilizar compras completadas';
  end if;

  select id into v_open_list_id
  from public.shopping_lists
  where user_id = v_user_id and status = 'open'
  limit 1;

  if v_open_list_id is not null then
    raise exception 'Ya tienes una lista de mercado abierta';
  end if;

  if not exists (
    select 1 from public.shopping_list_items
    where list_id = p_source_list_id and user_id = v_user_id
  ) then
    raise exception 'La compra no tiene productos para reutilizar';
  end if;

  insert into public.shopping_lists (user_id, name)
  values (v_user_id, v_source.name)
  returning id into v_new_list_id;

  insert into public.shopping_list_items (
    user_id, list_id, name, category, quantity, unit, estimated_price
  )
  select v_user_id, v_new_list_id, name, category, quantity, unit, estimated_price
  from public.shopping_list_items
  where list_id = p_source_list_id and user_id = v_user_id;

  get diagnostics v_items = row_count;

  return jsonb_build_object(
    'list_id', v_new_list_id,
    'items', v_items
  );
end;
$$;

revoke all on function public.reuse_shopping_list(uuid) from public;
grant execute on function public.reuse_shopping_list(uuid) to authenticated;

-- ============================================================
-- 0005_restore_empty_market.sql
-- ============================================================

create or replace function public.reuse_shopping_list(p_source_list_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.shopping_lists%rowtype;
  v_new_list_id uuid;
  v_open_list_id uuid;
  v_items integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_source
  from public.shopping_lists
  where id = p_source_list_id and user_id = v_user_id;

  if not found then
    raise exception 'Lista no encontrada';
  end if;

  if v_source.status <> 'completed' then
    raise exception 'Solo puedes reutilizar compras completadas';
  end if;

  if not exists (
    select 1 from public.shopping_list_items
    where list_id = p_source_list_id and user_id = v_user_id
  ) then
    raise exception 'La compra no tiene productos para reutilizar';
  end if;

  select id into v_open_list_id
  from public.shopping_lists
  where user_id = v_user_id and status = 'open'
  limit 1;

  if v_open_list_id is not null then
    if exists (
      select 1 from public.shopping_list_items
      where list_id = v_open_list_id and user_id = v_user_id
    ) then
      raise exception 'Ya tienes una lista abierta con productos';
    end if;
    v_new_list_id := v_open_list_id;
  else
    insert into public.shopping_lists (user_id, name)
    values (v_user_id, v_source.name)
    returning id into v_new_list_id;
  end if;

  insert into public.shopping_list_items (
    user_id, list_id, name, category, quantity, unit, estimated_price
  )
  select v_user_id, v_new_list_id, name, category, quantity, unit, estimated_price
  from public.shopping_list_items
  where list_id = p_source_list_id and user_id = v_user_id;

  get diagnostics v_items = row_count;

  return jsonb_build_object(
    'list_id', v_new_list_id,
    'items', v_items
  );
end;
$$;

revoke all on function public.reuse_shopping_list(uuid) from public;
grant execute on function public.reuse_shopping_list(uuid) to authenticated;

-- ============================================================
-- 0006_weekday_recurrence.sql
-- ============================================================

alter type public.recurrence_type add value if not exists 'weekdays';

-- ============================================================
-- 0007_finance.sql
-- ============================================================

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

-- ============================================================
-- 0008_recipe_import.sql
-- ============================================================

-- RECIPE IMPORT HELPER --------------------------------------------------------
-- Imports complete AI-researched recipes into an existing user account.
--
-- p_recipe keys:
--   name (text, required), description, servings (required), prep_minutes,
--   category (text, created if missing), tags (json array or comma string),
--   is_favorite (boolean), instructions (text with line breaks)
--
-- p_ingredients is an array of objects with:
--   name (required), quantity (required), unit ('g', 'ml', 'kg', 'l', 'ud'...),
--   brand, category, nutrition_unit ('g' or 'ml'), reference_amount (default 100),
--   calories, protein_g, carbs_g, fat_g, fiber_g (per reference_amount),
--   grams_per_unit (for unit-based foods such as eggs or bananas),
--   price (price per reference_amount, e.g. COP per 100 g),
--   food_notes, note (note for this recipe ingredient)
--
-- Existing foods are reused by (user_id, name). Only empty fields are filled.
-- Existing recipes with the same name for the user are updated and their
-- ingredients are replaced, so the import can be re-run safely.

create or replace function public.import_recipe(
  p_user_id uuid,
  p_recipe jsonb,
  p_ingredients jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_recipe_id uuid;
  v_category_id uuid;
  v_category_name text;
  v_name text;
  v_servings numeric;
  v_prep integer;
  v_tags text[] := '{}'::text[];
  v_ingredient jsonb;
  v_food_id uuid;
  v_food_name text;
  v_quantity numeric;
  v_unit text;
  v_nutrition_unit text;
  v_position integer := 0;
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Usuario no encontrado. Revisa el correo usado en auth.users.';
  end if;

  if jsonb_typeof(p_recipe) <> 'object' then
    raise exception 'p_recipe debe ser un objeto JSON';
  end if;

  if jsonb_typeof(coalesce(p_ingredients, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_ingredients, '[]'::jsonb)) = 0 then
    raise exception 'La receta necesita al menos un ingrediente';
  end if;

  v_name := trim(coalesce(p_recipe ->> 'name', ''));
  if length(v_name) = 0 then
    raise exception 'El nombre de la receta es obligatorio';
  end if;

  v_servings := coalesce(nullif(p_recipe ->> 'servings', '')::numeric, 1);
  if v_servings <= 0 then
    raise exception 'Las porciones deben ser mayores que cero';
  end if;

  if nullif(trim(coalesce(p_recipe ->> 'prep_minutes', '')), '') is not null then
    v_prep := (p_recipe ->> 'prep_minutes')::integer;
    if v_prep < 0 then
      raise exception 'El tiempo no puede ser negativo';
    end if;
  end if;

  v_category_name := nullif(trim(coalesce(p_recipe ->> 'category', '')), '');
  if v_category_name is not null then
    select id into v_category_id
    from public.categories
    where user_id = p_user_id
      and kind = 'recipe'
      and lower(name) = lower(v_category_name)
    limit 1;

    if v_category_id is null then
      insert into public.categories (user_id, kind, name)
      values (p_user_id, 'recipe', v_category_name)
      returning id into v_category_id;
    end if;
  end if;

  if jsonb_typeof(p_recipe -> 'tags') = 'array' then
    v_tags := array(select jsonb_array_elements_text(p_recipe -> 'tags'));
  elsif jsonb_typeof(p_recipe -> 'tags') = 'string' then
    v_tags := array(
      select trim(tag)
      from unnest(string_to_array(p_recipe ->> 'tags', ',')) as tag
      where trim(tag) <> ''
    );
  end if;

  select id into v_recipe_id
  from public.recipes
  where user_id = p_user_id and lower(name) = lower(v_name)
  limit 1;

  if v_recipe_id is null then
    insert into public.recipes (
      user_id, name, description, instructions, prep_minutes,
      servings, category_id, is_favorite, tags
    ) values (
      p_user_id,
      v_name,
      nullif(trim(coalesce(p_recipe ->> 'description', '')), ''),
      coalesce(p_recipe ->> 'instructions', ''),
      v_prep,
      v_servings,
      v_category_id,
      coalesce((p_recipe ->> 'is_favorite')::boolean, false),
      v_tags
    )
    returning id into v_recipe_id;
  else
    update public.recipes
    set description = nullif(trim(coalesce(p_recipe ->> 'description', '')), ''),
        instructions = coalesce(p_recipe ->> 'instructions', ''),
        prep_minutes = v_prep,
        servings = v_servings,
        category_id = v_category_id,
        is_favorite = coalesce((p_recipe ->> 'is_favorite')::boolean, false),
        tags = v_tags
    where id = v_recipe_id and user_id = p_user_id;

    delete from public.recipe_ingredients
    where recipe_id = v_recipe_id and user_id = p_user_id;
  end if;

  for v_ingredient in select * from jsonb_array_elements(p_ingredients)
  loop
    v_food_name := trim(coalesce(v_ingredient ->> 'name', ''));
    v_quantity := coalesce(nullif(v_ingredient ->> 'quantity', '')::numeric, 0);

    if length(v_food_name) = 0 then
      continue;
    end if;
    if v_quantity <= 0 then
      raise exception 'Cantidad inválida para el ingrediente %', v_food_name;
    end if;

    v_nutrition_unit := lower(coalesce(nullif(v_ingredient ->> 'nutrition_unit', ''), 'g'));
    if v_nutrition_unit not in ('g', 'ml') then
      raise exception 'nutrition_unit inválido para %: usa g o ml', v_food_name;
    end if;

    if coalesce(nullif(v_ingredient ->> 'reference_amount', '')::numeric, 100) <= 0 then
      raise exception 'reference_amount inválido para %', v_food_name;
    end if;

    v_unit := lower(trim(coalesce(
      nullif(v_ingredient ->> 'unit', ''),
      v_nutrition_unit,
      'g'
    )));
    if v_unit in ('unidad', 'unidades', 'u', 'un') then
      v_unit := 'ud';
    elsif v_unit = 'kg' then
      v_unit := 'g';
      v_quantity := v_quantity * 1000;
    elsif v_unit = 'l' then
      v_unit := 'ml';
      v_quantity := v_quantity * 1000;
    end if;

    if v_unit not in ('g', 'ml', 'ud') then
      raise exception 'Unidad no soportada para %: usa g, ml o ud', v_food_name;
    end if;

    if v_unit = 'ud'
       and nullif(v_ingredient ->> 'grams_per_unit', '') is null
       and not exists (
         select 1 from public.foods
         where user_id = p_user_id and name = v_food_name and grams_per_unit is not null
       ) then
      raise exception 'Falta grams_per_unit para % porque se usa la unidad ud', v_food_name;
    end if;

    insert into public.foods as food (
      user_id, name, brand, category, nutrition_unit, reference_amount,
      calories, protein_g, carbs_g, fat_g, fiber_g, grams_per_unit, price, notes
    ) values (
      p_user_id,
      v_food_name,
      nullif(trim(coalesce(v_ingredient ->> 'brand', '')), ''),
      nullif(trim(coalesce(v_ingredient ->> 'category', '')), ''),
      v_nutrition_unit,
      coalesce(nullif(v_ingredient ->> 'reference_amount', '')::numeric, 100),
      nullif(v_ingredient ->> 'calories', '')::numeric,
      nullif(v_ingredient ->> 'protein_g', '')::numeric,
      nullif(v_ingredient ->> 'carbs_g', '')::numeric,
      nullif(v_ingredient ->> 'fat_g', '')::numeric,
      nullif(v_ingredient ->> 'fiber_g', '')::numeric,
      nullif(v_ingredient ->> 'grams_per_unit', '')::numeric,
      nullif(v_ingredient ->> 'price', '')::numeric,
      nullif(trim(coalesce(v_ingredient ->> 'food_notes', '')), '')
    )
    on conflict (user_id, name) do update set
      brand = coalesce(food.brand, excluded.brand),
      category = coalesce(food.category, excluded.category),
      calories = coalesce(food.calories, excluded.calories),
      protein_g = coalesce(food.protein_g, excluded.protein_g),
      carbs_g = coalesce(food.carbs_g, excluded.carbs_g),
      fat_g = coalesce(food.fat_g, excluded.fat_g),
      fiber_g = coalesce(food.fiber_g, excluded.fiber_g),
      grams_per_unit = coalesce(food.grams_per_unit, excluded.grams_per_unit),
      price = coalesce(food.price, excluded.price),
      notes = coalesce(food.notes, excluded.notes)
    returning id into v_food_id;

    v_position := v_position + 1;

    insert into public.recipe_ingredients (
      user_id, recipe_id, food_id, name, quantity, unit, notes, position
    ) values (
      p_user_id,
      v_recipe_id,
      v_food_id,
      v_food_name,
      v_quantity,
      v_unit,
      nullif(trim(coalesce(v_ingredient ->> 'note', '')), ''),
      v_position
    );
  end loop;

  return v_recipe_id;
end;
$$;

comment on function public.import_recipe(uuid, jsonb, jsonb) is
  'Importa recetas completas con alimentos, nutrición por 100 g/ml, precios y pasos. Solo para uso administrativo.';

-- Importing is an admin/service operation. The app keeps using save_recipe.
revoke all on function public.import_recipe(uuid, jsonb, jsonb) from public;
revoke all on function public.import_recipe(uuid, jsonb, jsonb) from anon;
revoke all on function public.import_recipe(uuid, jsonb, jsonb) from authenticated;
grant execute on function public.import_recipe(uuid, jsonb, jsonb) to service_role;

-- ============================================================
-- 0009_custom_recurrence.sql
-- ============================================================

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

-- ============================================================
-- 0010_finance_savings.sql
-- ============================================================

alter table public.finance_transactions
  drop constraint if exists finance_transactions_kind_check;

alter table public.finance_transactions
  add constraint finance_transactions_kind_check
  check (kind in ('expense', 'income', 'saving'));

-- ============================================================
-- 0011_finance_savings_withdrawals.sql
-- ============================================================

alter table public.finance_transactions
  drop constraint if exists finance_transactions_kind_check;

alter table public.finance_transactions
  add constraint finance_transactions_kind_check
  check (kind in ('expense', 'income', 'saving', 'withdrawal'));
