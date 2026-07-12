-- HCM Workshop Manager
-- Historial general y programación de mantenimiento por motocicleta.

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id),
  motorcycle_id uuid not null
    references public.motorcycles(id)
    on delete cascade,
  work_order_id uuid
    references public.work_orders(id)
    on delete set null,
  service_type text not null
    check (service_type in (
      'Filtro de aceite', 'Filtro de aire', 'Ajuste de válvulas',
      'Líquido de frenos', 'Pastillas de freno', 'Refrigerante',
      'Bujías', 'Kit de arrastre', 'Llantas', 'Rodamientos',
      'Suspensión', 'Batería', 'Inyección / carburación',
      'Sistema eléctrico', 'Otro'
    )),
  service_date date not null default current_date,
  mileage integer check (mileage is null or mileage >= 0),
  details text,
  parts_used text,
  next_service_mileage integer
    check (
      next_service_mileage is null
      or mileage is null
      or next_service_mileage >= mileage
    ),
  next_service_date date,
  technician_name text,
  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_records_workshop_index
on public.maintenance_records(workshop_id);

create index if not exists maintenance_records_motorcycle_index
on public.maintenance_records(motorcycle_id, service_date desc);

create index if not exists maintenance_records_next_date_index
on public.maintenance_records(workshop_id, next_service_date)
where next_service_date is not null;

create or replace function public.validate_maintenance_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.motorcycles
    where id = new.motorcycle_id
      and workshop_id = new.workshop_id
  ) then
    raise exception 'La motocicleta pertenece a otro taller';
  end if;

  if new.work_order_id is not null and not exists (
    select 1 from public.work_orders
    where id = new.work_order_id
      and motorcycle_id = new.motorcycle_id
      and workshop_id = new.workshop_id
  ) then
    raise exception 'La OT no corresponde a esta motocicleta y taller';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_maintenance_workshop
on public.maintenance_records;

create trigger validate_maintenance_workshop
before insert or update on public.maintenance_records
for each row execute function public.validate_maintenance_links();

alter table public.maintenance_records enable row level security;

create policy "Miembros leen mantenimientos"
on public.maintenance_records
for select to authenticated
using (public.is_workshop_member(workshop_id));

create policy "Equipo registra mantenimientos"
on public.maintenance_records
for insert to authenticated
with check (
  public.has_workshop_role(
    workshop_id,
    array['owner','admin','reception','mechanic']
  )
);

create policy "Equipo actualiza mantenimientos"
on public.maintenance_records
for update to authenticated
using (
  public.has_workshop_role(
    workshop_id,
    array['owner','admin','reception','mechanic']
  )
)
with check (
  public.has_workshop_role(
    workshop_id,
    array['owner','admin','reception','mechanic']
  )
);

create policy "Administracion elimina mantenimientos"
on public.maintenance_records
for delete to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']));
