-- HCM Workshop Manager: asignación de técnicos a órdenes.
create table if not exists public.work_order_assignments (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id() references public.workshops(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  member_id uuid not null references public.workshop_members(id) on delete cascade,
  assigned_by uuid default auth.uid() references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (work_order_id, member_id)
);

create index if not exists work_order_assignments_order_index on public.work_order_assignments(work_order_id);
create index if not exists work_order_assignments_member_index on public.work_order_assignments(member_id);
alter table public.work_order_assignments enable row level security;
drop policy if exists "Miembros leen asignaciones" on public.work_order_assignments;
create policy "Miembros leen asignaciones" on public.work_order_assignments
for select to authenticated using (public.is_workshop_member(workshop_id));

create or replace function public.assign_work_order_technicians(p_work_order_id uuid, p_member_ids uuid[])
returns boolean language plpgsql security definer set search_path = public
as $$
declare target_order public.work_orders%rowtype; member_id uuid; technician_names text;
begin
  select * into target_order from public.work_orders where id = p_work_order_id;
  if not found then raise exception 'Orden no encontrada'; end if;
  if not public.has_workshop_role(target_order.workshop_id, array['owner','admin','reception']) then
    raise exception 'No tienes permiso para asignar técnicos';
  end if;
  foreach member_id in array coalesce(p_member_ids, array[]::uuid[]) loop
    if not exists (select 1 from public.workshop_members where id = member_id and workshop_id = target_order.workshop_id and role = 'mechanic' and active = true) then
      raise exception 'Uno de los técnicos no pertenece a este taller';
    end if;
  end loop;
  delete from public.work_order_assignments where work_order_id = target_order.id;
  insert into public.work_order_assignments (workshop_id, work_order_id, member_id, assigned_by)
  select target_order.workshop_id, target_order.id, id, auth.uid()
  from public.workshop_members where id = any(coalesce(p_member_ids, array[]::uuid[]));
  select string_agg(coalesce(display_name, email, 'Técnico'), ', ' order by display_name)
  into technician_names from public.workshop_members where id = any(coalesce(p_member_ids, array[]::uuid[]));
  insert into public.work_order_events (workshop_id, work_order_id, event_type, title, description, status, client_visible, created_by)
  values (target_order.workshop_id, target_order.id, 'Nota', 'Asignación de técnicos actualizada',
    case when technician_names is null then 'La orden quedó sin técnico asignado.' else 'Técnicos asignados: ' || technician_names || '.' end,
    target_order.status, false, auth.uid());
  return true;
end;
$$;
revoke all on function public.assign_work_order_technicians(uuid, uuid[]) from public;
grant execute on function public.assign_work_order_technicians(uuid, uuid[]) to authenticated;
