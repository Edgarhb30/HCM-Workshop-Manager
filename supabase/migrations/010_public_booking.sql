-- HCM Workshop Manager
-- Funciones públicas seguras para configuración, disponibilidad y reservas.

alter table public.appointments
add column if not exists email text;

create or replace function public.get_public_workshop_config(p_workshop_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', w.name,
    'slug', w.slug,
    'timezone', w.timezone,
    'phone', ws.phone,
    'whatsapp', ws.whatsapp,
    'email', ws.email,
    'address', ws.address,
    'logo_url', ws.logo_url,
    'appointment_slot_minutes', ws.appointment_slot_minutes,
    'manual_confirmation', ws.manual_appointment_confirmation,
    'public_booking_enabled', ws.public_booking_enabled,
    'business_hours', ws.business_hours
  )
  from public.workshops w
  join public.workshop_settings ws on ws.workshop_id = w.id
  where w.slug = p_workshop_slug
    and w.active = true;
$$;

create or replace function public.get_public_booked_slots(
  p_workshop_slug text,
  p_date date
)
returns table (appointment_time time)
language sql
stable
security definer
set search_path = public
as $$
  select a.appointment_time
  from public.appointments a
  join public.workshops w on w.id = a.workshop_id
  where w.slug = p_workshop_slug
    and w.active = true
    and a.appointment_date = p_date
    and a.status <> 'Cancelada'
  order by a.appointment_time;
$$;

create or replace function public.create_public_appointment(
  p_workshop_slug text,
  p_customer_name text,
  p_phone text,
  p_email text,
  p_brand text,
  p_model text,
  p_motorcycle_year integer,
  p_plate text,
  p_service text,
  p_date date,
  p_time time,
  p_customer_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workshop_id uuid;
  settings_record public.workshop_settings%rowtype;
  day_key text;
  day_hours jsonb;
  new_appointment_id uuid;
begin
  select w.id
  into target_workshop_id
  from public.workshops w
  where w.slug = p_workshop_slug
    and w.active = true;

  if not found then raise exception 'Taller no encontrado'; end if;

  select *
  into settings_record
  from public.workshop_settings
  where workshop_id = target_workshop_id;

  if not found then raise exception 'Configuración del taller no encontrada'; end if;
  if settings_record.public_booking_enabled = false then
    raise exception 'Las reservas públicas están desactivadas';
  end if;
  if p_date < current_date then raise exception 'No puedes reservar una fecha pasada'; end if;
  if trim(coalesce(p_customer_name, '')) = '' then raise exception 'El nombre es obligatorio'; end if;
  if trim(coalesce(p_phone, '')) = '' then raise exception 'El teléfono es obligatorio'; end if;
  if trim(coalesce(p_brand, '')) = '' or trim(coalesce(p_model, '')) = '' then
    raise exception 'La motocicleta es obligatoria';
  end if;

  day_key := case extract(dow from p_date)::integer
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    when 6 then 'saturday'
  end;
  day_hours := settings_record.business_hours -> day_key;

  if coalesce((day_hours ->> 'open')::boolean, false) = false then
    raise exception 'El taller está cerrado ese día';
  end if;
  if p_time < (day_hours ->> 'start')::time
     or p_time >= (day_hours ->> 'end')::time then
    raise exception 'La hora está fuera del horario del taller';
  end if;

  insert into public.appointments (
    workshop_id,
    customer_name,
    phone,
    email,
    brand,
    model,
    motorcycle_year,
    plate,
    service,
    appointment_date,
    appointment_time,
    customer_notes,
    internal_note,
    status
  ) values (
    target_workshop_id,
    trim(p_customer_name),
    trim(p_phone),
    nullif(trim(coalesce(p_email, '')), ''),
    trim(p_brand),
    trim(p_model),
    p_motorcycle_year,
    nullif(upper(trim(coalesce(p_plate, ''))), ''),
    trim(p_service),
    p_date,
    p_time,
    nullif(trim(coalesce(p_customer_notes, '')), ''),
    null,
    'Pendiente'
  ) returning id into new_appointment_id;

  return new_appointment_id;
end;
$$;

-- Las reservas anónimas solo se crean mediante la función validada.
drop policy if exists "Publico solicita citas" on public.appointments;
revoke execute on function public.get_booked_slots(date) from anon;

revoke all on function public.get_public_workshop_config(text) from public;
grant execute on function public.get_public_workshop_config(text) to anon, authenticated;
revoke all on function public.get_public_booked_slots(text, date) from public;
grant execute on function public.get_public_booked_slots(text, date) to anon, authenticated;
revoke all on function public.create_public_appointment(
  text, text, text, text, text, text, integer, text, text, date, time, text
) from public;
grant execute on function public.create_public_appointment(
  text, text, text, text, text, text, integer, text, text, date, time, text
) to anon, authenticated;
