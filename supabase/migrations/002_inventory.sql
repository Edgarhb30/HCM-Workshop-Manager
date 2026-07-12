-- HCM Workshop Manager
-- Inventario de repuestos, lubricantes y consumibles

create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text not null default 'Repuesto'
    check (category in ('Repuesto', 'Lubricante', 'Consumible', 'Otro')),
  unit text not null default 'unidad',
  stock numeric(12,2) not null default 0 check (stock >= 0),
  minimum_stock numeric(12,2) not null default 0 check (minimum_stock >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  location text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.inventory_products(id)
    on delete restrict,
  work_order_id uuid
    references public.work_orders(id)
    on delete set null,
  movement_type text not null
    check (movement_type in ('Entrada', 'Salida', 'Ajuste')),
  quantity numeric(12,2) not null
    check (
      (movement_type in ('Entrada', 'Salida') and quantity > 0)
      or (movement_type = 'Ajuste' and quantity <> 0)
    ),
  stock_before numeric(12,2) not null default 0,
  stock_after numeric(12,2) not null default 0,
  unit_cost numeric(12,2) check (unit_cost is null or unit_cost >= 0),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_products_name_index
on public.inventory_products(name);

create index if not exists inventory_movements_product_index
on public.inventory_movements(product_id, created_at desc);

create index if not exists inventory_movements_work_order_index
on public.inventory_movements(work_order_id);

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock numeric(12,2);
  next_stock numeric(12,2);
begin
  select stock
  into current_stock
  from public.inventory_products
  where id = new.product_id
  for update;

  if not found then
    raise exception 'Producto de inventario no encontrado';
  end if;

  next_stock := case new.movement_type
    when 'Entrada' then current_stock + new.quantity
    when 'Salida' then current_stock - new.quantity
    when 'Ajuste' then current_stock + new.quantity
  end;

  if next_stock < 0 then
    raise exception 'Stock insuficiente. Existencia actual: %', current_stock;
  end if;

  new.stock_before := current_stock;
  new.stock_after := next_stock;

  update public.inventory_products
  set
    stock = next_stock,
    cost_price = case
      when new.movement_type = 'Entrada' and new.unit_cost is not null
        then new.unit_cost
      else cost_price
    end,
    updated_at = now()
  where id = new.product_id;

  return new;
end;
$$;

drop trigger if exists update_inventory_stock
on public.inventory_movements;

create trigger update_inventory_stock
before insert on public.inventory_movements
for each row
execute function public.apply_inventory_movement();

alter table public.inventory_products enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "Administrador gestiona productos"
on public.inventory_products;

create policy "Administrador gestiona productos"
on public.inventory_products
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Administrador gestiona movimientos"
on public.inventory_movements;

create policy "Administrador gestiona movimientos"
on public.inventory_movements
for all
to authenticated
using (true)
with check (true);
