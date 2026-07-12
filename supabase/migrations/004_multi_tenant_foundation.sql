-- HCM Workshop Manager
-- Base multi-taller segura: talleres, miembros, roles y aislamiento de datos.

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Costa_Rica',
  currency text not null default 'CRC',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workshop_members (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'mechanic'
    check (role in ('owner', 'admin', 'reception', 'mechanic', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workshop_id, user_id)
);

insert into public.workshops (name, slug, timezone, currency)
values ('Herrera Custom Motorcycle', 'herrera-custom-motorcycle', 'America/Costa_Rica', 'CRC')
on conflict (slug) do update set name = excluded.name;

-- Solo la cuenta del propietario recibe acceso inicial.
insert into public.workshop_members (workshop_id, user_id, role)
select w.id, u.id, 'owner'
from public.workshops w
join auth.users u on lower(u.email) = 'edgarhb30@gmail.com'
where w.slug = 'herrera-custom-motorcycle'
on conflict (workshop_id, user_id) do update
set role = 'owner', active = true;

create or replace function public.current_workshop_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select case
    when auth.role() = 'anon' then (
      select id from public.workshops
      where slug = 'herrera-custom-motorcycle' and active = true
      limit 1
    )
    else (
      select workshop_id from public.workshop_members
      where user_id = auth.uid() and active = true
      order by created_at limit 1
    )
  end;
$$;

create or replace function public.is_workshop_member(p_workshop_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id
      and user_id = auth.uid()
      and active = true
  );
$$;

create or replace function public.has_workshop_role(p_workshop_id uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workshop_members
    where workshop_id = p_workshop_id
      and user_id = auth.uid()
      and active = true
      and role = any(p_roles)
  );
$$;

alter table public.appointments add column if not exists workshop_id uuid references public.workshops(id);
alter table public.customers add column if not exists workshop_id uuid references public.workshops(id);
alter table public.motorcycles add column if not exists workshop_id uuid references public.workshops(id);
alter table public.work_orders add column if not exists workshop_id uuid references public.workshops(id);
alter table public.oil_changes add column if not exists workshop_id uuid references public.workshops(id);
alter table public.quotes add column if not exists workshop_id uuid references public.workshops(id);
alter table public.quote_items add column if not exists workshop_id uuid references public.workshops(id);
alter table public.inventory_products add column if not exists workshop_id uuid references public.workshops(id);
alter table public.inventory_movements add column if not exists workshop_id uuid references public.workshops(id);

do $$
declare hcm_id uuid;
begin
  select id into hcm_id from public.workshops where slug = 'herrera-custom-motorcycle';
  update public.appointments set workshop_id = hcm_id where workshop_id is null;
  update public.customers set workshop_id = hcm_id where workshop_id is null;
  update public.motorcycles set workshop_id = hcm_id where workshop_id is null;
  update public.work_orders set workshop_id = hcm_id where workshop_id is null;
  update public.oil_changes set workshop_id = hcm_id where workshop_id is null;
  update public.quotes set workshop_id = hcm_id where workshop_id is null;
  update public.quote_items qi set workshop_id = q.workshop_id
    from public.quotes q where qi.quote_id = q.id and qi.workshop_id is null;
  update public.inventory_products set workshop_id = hcm_id where workshop_id is null;
  update public.inventory_movements im set workshop_id = ip.workshop_id
    from public.inventory_products ip
    where im.product_id = ip.id and im.workshop_id is null;
end;
$$;

alter table public.appointments alter column workshop_id set default public.current_workshop_id();
alter table public.customers alter column workshop_id set default public.current_workshop_id();
alter table public.motorcycles alter column workshop_id set default public.current_workshop_id();
alter table public.work_orders alter column workshop_id set default public.current_workshop_id();
alter table public.oil_changes alter column workshop_id set default public.current_workshop_id();
alter table public.quotes alter column workshop_id set default public.current_workshop_id();
alter table public.quote_items alter column workshop_id set default public.current_workshop_id();
alter table public.inventory_products alter column workshop_id set default public.current_workshop_id();
alter table public.inventory_movements alter column workshop_id set default public.current_workshop_id();

alter table public.appointments alter column workshop_id set not null;
alter table public.customers alter column workshop_id set not null;
alter table public.motorcycles alter column workshop_id set not null;
alter table public.work_orders alter column workshop_id set not null;
alter table public.oil_changes alter column workshop_id set not null;
alter table public.quotes alter column workshop_id set not null;
alter table public.quote_items alter column workshop_id set not null;
alter table public.inventory_products alter column workshop_id set not null;
alter table public.inventory_movements alter column workshop_id set not null;

-- Impedir relaciones cruzadas entre talleres, incluso por identificador directo.
create or replace function public.validate_same_workshop_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'motorcycles' then
    if not exists (
      select 1 from public.customers
      where id = new.customer_id and workshop_id = new.workshop_id
    ) then raise exception 'El cliente pertenece a otro taller'; end if;

  elsif tg_table_name = 'work_orders' then
    if not exists (
      select 1 from public.customers
      where id = new.customer_id and workshop_id = new.workshop_id
    ) then raise exception 'El cliente pertenece a otro taller'; end if;
    if not exists (
      select 1 from public.motorcycles
      where id = new.motorcycle_id and workshop_id = new.workshop_id
    ) then raise exception 'La motocicleta pertenece a otro taller'; end if;

  elsif tg_table_name = 'oil_changes' then
    if not exists (
      select 1 from public.motorcycles
      where id = new.motorcycle_id and workshop_id = new.workshop_id
    ) then raise exception 'La motocicleta pertenece a otro taller'; end if;
    if new.work_order_id is not null and not exists (
      select 1 from public.work_orders
      where id = new.work_order_id and workshop_id = new.workshop_id
    ) then raise exception 'La OT pertenece a otro taller'; end if;

  elsif tg_table_name = 'quotes' then
    if not exists (
      select 1 from public.work_orders
      where id = new.work_order_id and workshop_id = new.workshop_id
    ) then raise exception 'La OT pertenece a otro taller'; end if;

  elsif tg_table_name = 'quote_items' then
    if not exists (
      select 1 from public.quotes
      where id = new.quote_id and workshop_id = new.workshop_id
    ) then raise exception 'El presupuesto pertenece a otro taller'; end if;
    if new.product_id is not null and not exists (
      select 1 from public.inventory_products
      where id = new.product_id and workshop_id = new.workshop_id
    ) then raise exception 'El producto pertenece a otro taller'; end if;

  elsif tg_table_name = 'inventory_movements' then
    if not exists (
      select 1 from public.inventory_products
      where id = new.product_id and workshop_id = new.workshop_id
    ) then raise exception 'El producto pertenece a otro taller'; end if;
    if new.work_order_id is not null and not exists (
      select 1 from public.work_orders
      where id = new.work_order_id and workshop_id = new.workshop_id
    ) then raise exception 'La OT pertenece a otro taller'; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_motorcycle_workshop on public.motorcycles;
create trigger validate_motorcycle_workshop
before insert or update on public.motorcycles
for each row execute function public.validate_same_workshop_links();

drop trigger if exists validate_work_order_workshop on public.work_orders;
create trigger validate_work_order_workshop
before insert or update on public.work_orders
for each row execute function public.validate_same_workshop_links();

drop trigger if exists validate_oil_change_workshop on public.oil_changes;
create trigger validate_oil_change_workshop
before insert or update on public.oil_changes
for each row execute function public.validate_same_workshop_links();

drop trigger if exists validate_quote_workshop on public.quotes;
create trigger validate_quote_workshop
before insert or update on public.quotes
for each row execute function public.validate_same_workshop_links();

drop trigger if exists validate_quote_item_workshop on public.quote_items;
create trigger validate_quote_item_workshop
before insert or update on public.quote_items
for each row execute function public.validate_same_workshop_links();

drop trigger if exists validate_inventory_movement_workshop on public.inventory_movements;
create trigger validate_inventory_movement_workshop
before insert or update on public.inventory_movements
for each row execute function public.validate_same_workshop_links();

create index if not exists appointments_workshop_index on public.appointments(workshop_id);
create index if not exists customers_workshop_index on public.customers(workshop_id);
create index if not exists motorcycles_workshop_index on public.motorcycles(workshop_id);
create index if not exists work_orders_workshop_index on public.work_orders(workshop_id);
create index if not exists oil_changes_workshop_index on public.oil_changes(workshop_id);
create index if not exists quotes_workshop_index on public.quotes(workshop_id);
create index if not exists quote_items_workshop_index on public.quote_items(workshop_id);
create index if not exists inventory_products_workshop_index on public.inventory_products(workshop_id);
create index if not exists inventory_movements_workshop_index on public.inventory_movements(workshop_id);

drop index if exists public.appointments_unique_active_slot;
create unique index appointments_unique_active_slot
on public.appointments(workshop_id, appointment_date, appointment_time)
where status <> 'Cancelada';

alter table public.workshops enable row level security;
alter table public.workshop_members enable row level security;

-- Retirar las políticas anteriores antes de crear las aisladas por taller.
do $$
declare t text; p text;
begin
  foreach t in array array[
    'appointments','customers','motorcycles','work_orders','oil_changes',
    'quotes','quote_items','inventory_products','inventory_movements'
  ] loop
    for p in select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;
  end loop;
end;
$$;

drop policy if exists "Miembros ven su taller" on public.workshops;
create policy "Miembros ven su taller" on public.workshops
for select to authenticated using (public.is_workshop_member(id));

drop policy if exists "Propietarios administran taller" on public.workshops;
create policy "Propietarios administran taller" on public.workshops
for update to authenticated
using (public.has_workshop_role(id, array['owner','admin']))
with check (public.has_workshop_role(id, array['owner','admin']));

drop policy if exists "Miembros ven equipo" on public.workshop_members;
create policy "Miembros ven equipo" on public.workshop_members
for select to authenticated using (public.is_workshop_member(workshop_id));

drop policy if exists "Propietarios administran equipo" on public.workshop_members;
create policy "Propietarios administran equipo" on public.workshop_members
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']))
with check (public.has_workshop_role(workshop_id, array['owner','admin']));

-- Lectura: cualquier miembro activo. Escritura: solo los roles indicados.
create policy "Miembros leen citas" on public.appointments
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Recepcion gestiona citas" on public.appointments
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create policy "Miembros leen clientes" on public.customers
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Recepcion gestiona clientes" on public.customers
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create policy "Miembros leen motocicletas" on public.motorcycles
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Recepcion gestiona motocicletas" on public.motorcycles
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create policy "Miembros leen ordenes" on public.work_orders
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Equipo gestiona ordenes" on public.work_orders
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception','mechanic']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception','mechanic']));

create policy "Miembros leen aceite" on public.oil_changes
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Tecnicos gestionan aceite" on public.oil_changes
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']));

create policy "Miembros leen presupuestos" on public.quotes
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Administracion gestiona presupuestos" on public.quotes
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));
create policy "Miembros leen lineas" on public.quote_items
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Administracion gestiona lineas" on public.quote_items
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create policy "Miembros leen productos" on public.inventory_products
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Tecnicos gestionan productos" on public.inventory_products
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']));
create policy "Miembros leen movimientos" on public.inventory_movements
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Tecnicos gestionan movimientos" on public.inventory_movements
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']));

create policy "Publico solicita citas" on public.appointments
for insert to anon
with check (
  workshop_id = public.current_workshop_id()
  and status = 'Pendiente'
  and internal_note is null
);

create or replace function public.get_booked_slots(p_date date)
returns table (appointment_time time)
language sql security definer set search_path = public
as $$
  select appointment_time from public.appointments
  where workshop_id = public.current_workshop_id()
    and appointment_date = p_date
    and status <> 'Cancelada';
$$;

revoke all on function public.current_workshop_id() from public;
grant execute on function public.current_workshop_id() to anon, authenticated;
revoke all on function public.is_workshop_member(uuid) from public;
grant execute on function public.is_workshop_member(uuid) to authenticated;
revoke all on function public.has_workshop_role(uuid, text[]) from public;
grant execute on function public.has_workshop_role(uuid, text[]) to authenticated;
revoke all on function public.get_booked_slots(date) from public;
grant execute on function public.get_booked_slots(date) to anon, authenticated;
