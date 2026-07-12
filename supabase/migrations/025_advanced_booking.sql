-- HCM Workshop Manager: agenda avanzada, servicios, bloqueos y disponibilidad real.
alter table public.workshop_settings add column if not exists minimum_booking_notice_hours integer not null default 2;
alter table public.workshop_settings add column if not exists maximum_booking_days integer not null default 60;
alter table public.workshop_settings add column if not exists maximum_appointments_per_day integer;

create table if not exists public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id() references public.workshops(id) on delete cascade,
  name text not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 1440),
  public_enabled boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workshop_id, name)
);

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id() references public.workshops(id) on delete cascade,
  block_date date not null,
  all_day boolean not null default true,
  start_time time,
  end_time time,
  reason text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (all_day or (start_time is not null and end_time is not null and end_time > start_time))
);

alter table public.appointments add column if not exists service_id uuid references public.appointment_services(id) on delete set null;
alter table public.appointments add column if not exists duration_minutes integer not null default 60;

insert into public.appointment_services (workshop_id, name, duration_minutes)
select w.id, service.name, service.duration
from public.workshops w
cross join (values
  ('Mantenimiento general',120), ('Cambio de aceite',60), ('Diagnóstico',90),
  ('Electricidad',90), ('Frenos',90), ('Suspensión',120), ('Motor',180),
  ('Instalación de accesorios',90), ('Otro',60)
) as service(name, duration)
on conflict (workshop_id, name) do nothing;

alter table public.appointment_services enable row level security;
alter table public.schedule_blocks enable row level security;
drop policy if exists "Miembros leen servicios" on public.appointment_services;
create policy "Miembros leen servicios" on public.appointment_services for select to authenticated using (public.is_workshop_member(workshop_id));
drop policy if exists "Administracion gestiona servicios" on public.appointment_services;
create policy "Administracion gestiona servicios" on public.appointment_services for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin'])) with check (public.has_workshop_role(workshop_id, array['owner','admin']));
drop policy if exists "Miembros leen bloqueos" on public.schedule_blocks;
create policy "Miembros leen bloqueos" on public.schedule_blocks for select to authenticated using (public.is_workshop_member(workshop_id));
drop policy if exists "Recepcion gestiona bloqueos" on public.schedule_blocks;
create policy "Recepcion gestiona bloqueos" on public.schedule_blocks for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception'])) with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create or replace function public.get_public_booking_config(p_workshop_slug text)
returns jsonb language sql stable security definer set search_path = public
as $$
select jsonb_build_object(
  'name', w.name, 'slug', w.slug, 'timezone', w.timezone,
  'phone', ws.phone, 'whatsapp', ws.whatsapp, 'email', ws.email, 'address', ws.address,
  'logo_url', ws.logo_url, 'manual_confirmation', ws.manual_appointment_confirmation,
  'public_booking_enabled', ws.public_booking_enabled, 'business_hours', ws.business_hours,
  'minimum_notice_hours', ws.minimum_booking_notice_hours,
  'maximum_booking_days', ws.maximum_booking_days,
  'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes) order by s.name)
    from public.appointment_services s where s.workshop_id = w.id and s.active and s.public_enabled), '[]'::jsonb)
)
from public.workshops w join public.workshop_settings ws on ws.workshop_id = w.id
where w.slug = p_workshop_slug and w.active;
$$;

create or replace function public.get_public_available_slots(p_workshop_slug text, p_date date, p_service_id uuid)
returns table (appointment_time time) language plpgsql stable security definer set search_path = public
as $$
declare wid uuid; settings public.workshop_settings%rowtype; hours jsonb; duration integer; day_key text;
begin
  select w.id into wid from public.workshops w where w.slug = p_workshop_slug and w.active;
  select * into settings from public.workshop_settings where workshop_id = wid;
  select duration_minutes into duration from public.appointment_services where id = p_service_id and workshop_id = wid and active and public_enabled;
  if duration is null or p_date < current_date or p_date > current_date + settings.maximum_booking_days then return; end if;
  if settings.maximum_appointments_per_day is not null and (select count(*) from public.appointments where workshop_id = wid and appointment_date = p_date and status <> 'Cancelada') >= settings.maximum_appointments_per_day then return; end if;
  day_key := (array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[extract(dow from p_date)::integer + 1];
  hours := settings.business_hours -> day_key;
  if not coalesce((hours->>'open')::boolean,false) then return; end if;
  return query
  select slot::time from generate_series(
    p_date + (hours->>'start')::time,
    p_date + (hours->>'end')::time - make_interval(mins => duration),
    make_interval(mins => settings.appointment_slot_minutes)
  ) slot
  where slot >= now() + make_interval(hours => settings.minimum_booking_notice_hours)
    and not exists (select 1 from public.schedule_blocks b where b.workshop_id = wid and b.block_date = p_date and (b.all_day or (slot::time < b.end_time and (slot + make_interval(mins => duration))::time > b.start_time)))
    and not exists (select 1 from public.appointments a where a.workshop_id = wid and a.appointment_date = p_date and a.status <> 'Cancelada' and slot::time < a.appointment_time + make_interval(mins => a.duration_minutes) and (slot + make_interval(mins => duration))::time > a.appointment_time)
  order by slot;
end;
$$;

create or replace function public.create_public_appointment_v2(
  p_workshop_slug text, p_customer_name text, p_phone text, p_email text,
  p_brand text, p_model text, p_motorcycle_year integer, p_plate text,
  p_service_id uuid, p_date date, p_time time, p_customer_notes text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare wid uuid; service_record public.appointment_services%rowtype; new_id uuid;
begin
  select id into wid from public.workshops where slug = p_workshop_slug and active;
  select * into service_record from public.appointment_services where id = p_service_id and workshop_id = wid and active and public_enabled;
  if service_record.id is null then raise exception 'Servicio no disponible'; end if;
  if not exists (select 1 from public.get_public_available_slots(p_workshop_slug, p_date, p_service_id) slots where slots.appointment_time = p_time) then
    raise exception 'Ese horario no está disponible';
  end if;
  insert into public.appointments (workshop_id, customer_name, phone, email, brand, model, motorcycle_year, plate, service, service_id, duration_minutes, appointment_date, appointment_time, customer_notes, status)
  values (wid, trim(p_customer_name), trim(p_phone), nullif(trim(coalesce(p_email,'')),''), trim(p_brand), trim(p_model), p_motorcycle_year,
    nullif(upper(trim(coalesce(p_plate,''))),''), service_record.name, service_record.id, service_record.duration_minutes, p_date, p_time,
    nullif(trim(coalesce(p_customer_notes,'')),''), 'Pendiente') returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.get_public_booking_config(text) from public;
grant execute on function public.get_public_booking_config(text) to anon, authenticated;
revoke all on function public.get_public_available_slots(text,date,uuid) from public;
grant execute on function public.get_public_available_slots(text,date,uuid) to anon, authenticated;
revoke all on function public.create_public_appointment_v2(text,text,text,text,text,text,integer,text,uuid,date,time,text) from public;
grant execute on function public.create_public_appointment_v2(text,text,text,text,text,text,integer,text,uuid,date,time,text) to anon, authenticated;
