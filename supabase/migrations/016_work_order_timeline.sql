-- HCM Workshop Manager
-- Línea de tiempo auditable y visible de las órdenes de trabajo.

create table if not exists public.work_order_events (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id),
  work_order_id uuid not null
    references public.work_orders(id)
    on delete cascade,
  event_type text not null default 'Nota'
    check (event_type in (
      'Recepción', 'Cambio de estado', 'Diagnóstico', 'Presupuesto',
      'Repuesto', 'Reparación', 'Prueba', 'Entrega', 'Nota'
    )),
  title text not null,
  description text,
  status text,
  client_visible boolean not null default false,
  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists work_order_events_workshop_index
on public.work_order_events(workshop_id);

create index if not exists work_order_events_order_index
on public.work_order_events(work_order_id, created_at desc);

create or replace function public.validate_work_order_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.work_orders
    where id = new.work_order_id
      and workshop_id = new.workshop_id
  ) then
    raise exception 'La OT pertenece a otro taller';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_event_workshop on public.work_order_events;
create trigger validate_event_workshop
before insert or update on public.work_order_events
for each row execute function public.validate_work_order_event();

create or replace function public.record_work_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_kind text;
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_events (
      workshop_id, work_order_id, event_type, title,
      description, status, client_visible, created_by, created_at
    ) values (
      new.workshop_id, new.id, 'Recepción', 'Motocicleta recibida',
      'La orden de trabajo fue creada.', new.status, true,
      auth.uid(), coalesce(new.received_at, now())
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    event_kind := case new.status
      when 'Diagnóstico' then 'Diagnóstico'
      when 'Esperando aprobación' then 'Presupuesto'
      when 'Esperando repuestos' then 'Repuesto'
      when 'En reparación' then 'Reparación'
      when 'Prueba' then 'Prueba'
      when 'Entregada' then 'Entrega'
      else 'Cambio de estado'
    end;

    insert into public.work_order_events (
      workshop_id, work_order_id, event_type, title,
      description, status, client_visible, created_by
    ) values (
      new.workshop_id,
      new.id,
      event_kind,
      'Estado actualizado: ' || new.status,
      case new.status
        when 'Diagnóstico' then 'El taller inició la revisión técnica.'
        when 'Esperando aprobación' then 'El trabajo está esperando autorización del cliente.'
        when 'Esperando repuestos' then 'La orden está a la espera de repuestos.'
        when 'En reparación' then 'Los trabajos autorizados están en proceso.'
        when 'Prueba' then 'La motocicleta se encuentra en comprobaciones finales.'
        when 'Lista para entregar' then 'La motocicleta está lista para ser retirada.'
        when 'Entregada' then 'La motocicleta fue entregada.'
        when 'Cancelada' then 'La orden fue cancelada.'
        else 'El estado de la orden fue actualizado.'
      end,
      new.status,
      true,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists record_work_order_event on public.work_orders;
create trigger record_work_order_event
after insert or update of status on public.work_orders
for each row execute function public.record_work_order_status_event();

-- Crear el evento inicial para las órdenes existentes sin historial.
insert into public.work_order_events (
  workshop_id, work_order_id, event_type, title,
  description, status, client_visible, created_at
)
select
  wo.workshop_id,
  wo.id,
  'Recepción',
  'Motocicleta recibida',
  'La orden de trabajo fue creada.',
  wo.status,
  true,
  coalesce(wo.received_at, now())
from public.work_orders wo
where not exists (
  select 1 from public.work_order_events event
  where event.work_order_id = wo.id
);

alter table public.work_order_events enable row level security;

create policy "Miembros leen eventos"
on public.work_order_events
for select to authenticated
using (public.is_workshop_member(workshop_id));

create policy "Equipo registra eventos"
on public.work_order_events
for insert to authenticated
with check (
  public.has_workshop_role(
    workshop_id,
    array['owner','admin','reception','mechanic']
  )
);

create policy "Equipo actualiza eventos"
on public.work_order_events
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

create policy "Administracion elimina eventos"
on public.work_order_events
for delete to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']));
