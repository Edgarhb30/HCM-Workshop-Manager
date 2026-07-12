-- HCM Workshop Manager: notificaciones internas por usuario.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null default 'Información',
  title text not null,
  message text,
  link_type text,
  link_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_index
on public.notifications(user_id, read_at, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Usuarios leen sus notificaciones" on public.notifications;
create policy "Usuarios leen sus notificaciones" on public.notifications
for select to authenticated using (user_id = auth.uid() and public.is_workshop_member(workshop_id));
drop policy if exists "Usuarios actualizan sus notificaciones" on public.notifications;
create policy "Usuarios actualizan sus notificaciones" on public.notifications
for update to authenticated using (user_id = auth.uid() and public.is_workshop_member(workshop_id))
with check (user_id = auth.uid() and public.is_workshop_member(workshop_id));

create or replace function public.notify_work_order_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_user uuid; order_number text;
begin
  select user_id into target_user from public.workshop_members where id = new.member_id and active = true;
  select wo.order_number into order_number from public.work_orders wo where wo.id = new.work_order_id;
  if target_user is not null then
    insert into public.notifications (workshop_id, user_id, notification_type, title, message, link_type, link_id)
    values (new.workshop_id, target_user, 'Asignación', 'Nueva orden asignada',
      'Te asignaron la orden ' || coalesce(order_number, ''), 'work_order', new.work_order_id);
  end if;
  return new;
end;
$$;
drop trigger if exists notify_assignment on public.work_order_assignments;
create trigger notify_assignment after insert on public.work_order_assignments
for each row execute function public.notify_work_order_assignment();

create or replace function public.notify_new_appointment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (workshop_id, user_id, notification_type, title, message, link_type, link_id)
  select new.workshop_id, wm.user_id, 'Cita', 'Nueva solicitud de cita',
    new.customer_name || ' · ' || new.appointment_date::text || ' ' || new.appointment_time::text,
    'appointment', new.id
  from public.workshop_members wm
  where wm.workshop_id = new.workshop_id and wm.active = true and wm.role in ('owner','admin','reception');
  return new;
end;
$$;
drop trigger if exists notify_appointment on public.appointments;
create trigger notify_appointment after insert on public.appointments
for each row execute function public.notify_new_appointment();

create or replace function public.notify_work_order_status()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  insert into public.notifications (workshop_id, user_id, notification_type, title, message, link_type, link_id)
  select distinct new.workshop_id, recipients.user_id, 'Estado', 'Orden actualizada',
    new.order_number || ' cambió a ' || new.status, 'work_order', new.id
  from (
    select wm.user_id from public.workshop_members wm
    where wm.workshop_id = new.workshop_id and wm.active = true and wm.role in ('owner','admin','reception')
    union
    select wm.user_id from public.work_order_assignments wa
    join public.workshop_members wm on wm.id = wa.member_id
    where wa.work_order_id = new.id and wm.active = true
  ) recipients;
  return new;
end;
$$;
drop trigger if exists notify_order_status on public.work_orders;
create trigger notify_order_status after update of status on public.work_orders
for each row execute function public.notify_work_order_status();

