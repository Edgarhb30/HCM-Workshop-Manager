-- HCM Workshop Manager
-- Vincula repuestos presupuestados con el inventario

alter table public.quote_items
add column if not exists product_id uuid
references public.inventory_products(id)
on delete set null;

alter table public.quote_items
add column if not exists inventory_deducted boolean
not null default false;

create index if not exists quote_items_product_id_index
on public.quote_items(product_id);

create or replace function public.consume_quote_inventory(p_quote_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_work_order_id uuid;
  quote_status text;
  item record;
  consumed_count integer := 0;
begin
  select work_order_id, status
  into quote_work_order_id, quote_status
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'Presupuesto no encontrado';
  end if;

  if quote_status <> 'Aprobado' then
    raise exception 'El presupuesto debe estar aprobado antes de descontar repuestos';
  end if;

  for item in
    select id, product_id, quantity, description
    from public.quote_items
    where quote_id = p_quote_id
      and product_id is not null
      and inventory_deducted = false
    for update
  loop
    insert into public.inventory_movements (
      product_id,
      work_order_id,
      movement_type,
      quantity,
      reason
    ) values (
      item.product_id,
      quote_work_order_id,
      'Salida',
      item.quantity,
      'Instalado según presupuesto: ' || item.description
    );

    update public.quote_items
    set inventory_deducted = true
    where id = item.id;

    consumed_count := consumed_count + 1;
  end loop;

  return consumed_count;
end;
$$;

revoke all on function public.consume_quote_inventory(uuid) from public;
grant execute on function public.consume_quote_inventory(uuid)
to authenticated;
