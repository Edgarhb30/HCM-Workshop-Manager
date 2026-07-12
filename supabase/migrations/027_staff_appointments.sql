-- HCM Workshop Manager: creación manual de citas desde el taller.
alter table public.appointments add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.appointments add column if not exists motorcycle_id uuid references public.motorcycles(id) on delete set null;

create or replace function public.create_staff_appointment(
  p_customer_id uuid, p_motorcycle_id uuid,
  p_customer_name text, p_phone text, p_email text,
  p_brand text, p_model text, p_motorcycle_year integer, p_plate text,
  p_service_id uuid, p_date date, p_time time,
  p_customer_notes text, p_internal_note text, p_status text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare wid uuid; service public.appointment_services%rowtype; settings public.workshop_settings%rowtype;
  customer public.customers%rowtype; motorcycle public.motorcycles%rowtype;
  day_key text; hours jsonb; new_id uuid;
begin
  wid := public.current_workshop_id();
  if not public.has_workshop_role(wid, array['owner','admin','reception']) then raise exception 'No tienes permiso para crear citas'; end if;
  if p_status not in ('Pendiente','Confirmada') then raise exception 'Estado no permitido'; end if;
  if p_customer_id is not null then
    select * into customer from public.customers where id = p_customer_id and workshop_id = wid;
    if not found then raise exception 'Cliente no encontrado'; end if;
  end if;
  if p_motorcycle_id is not null then
    select * into motorcycle from public.motorcycles where id = p_motorcycle_id and workshop_id = wid and (p_customer_id is null or customer_id = p_customer_id);
    if not found then raise exception 'Motocicleta no encontrada'; end if;
  end if;
  select * into service from public.appointment_services where id = p_service_id and workshop_id = wid and active;
  if not found then raise exception 'Servicio no disponible'; end if;
  select * into settings from public.workshop_settings where workshop_id = wid;
  if p_date < current_date then raise exception 'No puedes crear una cita en el pasado'; end if;
  day_key := (array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[extract(dow from p_date)::integer + 1];
  hours := settings.business_hours -> day_key;
  if not coalesce((hours->>'open')::boolean,false) then raise exception 'El taller está cerrado ese día'; end if;
  if p_time < (hours->>'start')::time or p_time + make_interval(mins => service.duration_minutes) > (hours->>'end')::time then raise exception 'El servicio no cabe dentro del horario'; end if;
  if exists (select 1 from public.schedule_blocks b where b.workshop_id = wid and b.block_date = p_date and (b.all_day or (p_time < b.end_time and p_time + make_interval(mins => service.duration_minutes) > b.start_time))) then raise exception 'Ese horario está bloqueado'; end if;
  if exists (select 1 from public.appointments a where a.workshop_id = wid and a.appointment_date = p_date and a.status <> 'Cancelada' and p_time < a.appointment_time + make_interval(mins => a.duration_minutes) and p_time + make_interval(mins => service.duration_minutes) > a.appointment_time) then raise exception 'Ese horario se traslapa con otra cita'; end if;
  insert into public.appointments (
    workshop_id, customer_id, motorcycle_id, customer_name, phone, email,
    brand, model, motorcycle_year, plate, service, service_id, duration_minutes,
    appointment_date, appointment_time, customer_notes, internal_note, status
  ) values (
    wid, p_customer_id, p_motorcycle_id,
    coalesce(customer.full_name, nullif(trim(p_customer_name),'')),
    coalesce(customer.phone, nullif(trim(p_phone),'')),
    coalesce(customer.email, nullif(trim(coalesce(p_email,'')),'')),
    coalesce(motorcycle.brand, nullif(trim(p_brand),'')),
    coalesce(motorcycle.model, nullif(trim(p_model),'')),
    coalesce(motorcycle.motorcycle_year, p_motorcycle_year),
    coalesce(motorcycle.plate, nullif(upper(trim(coalesce(p_plate,''))),'')),
    service.name, service.id, service.duration_minutes, p_date, p_time,
    nullif(trim(coalesce(p_customer_notes,'')),''), nullif(trim(coalesce(p_internal_note,'')),''), p_status
  ) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_staff_appointment(uuid,uuid,text,text,text,text,text,integer,text,uuid,date,time,text,text,text) from public;
grant execute on function public.create_staff_appointment(uuid,uuid,text,text,text,text,text,integer,text,uuid,date,time,text,text,text) to authenticated;
