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
