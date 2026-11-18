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
