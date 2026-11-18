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
