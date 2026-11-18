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
