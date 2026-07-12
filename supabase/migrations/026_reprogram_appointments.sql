-- HCM Workshop Manager: reprogramación validada de citas.
create or replace function public.reprogram_appointment(
  p_appointment_id uuid, p_service_id uuid, p_date date, p_time time
)
returns boolean language plpgsql security definer set search_path = public
as $$
declare appointment public.appointments%rowtype; service public.appointment_services%rowtype;
  settings public.workshop_settings%rowtype; day_key text; hours jsonb;
begin
  select * into appointment from public.appointments where id = p_appointment_id;
  if not found then raise exception 'Cita no encontrada'; end if;
  if not public.has_workshop_role(appointment.workshop_id, array['owner','admin','reception']) then raise exception 'No tienes permiso para reprogramar'; end if;
  select * into service from public.appointment_services where id = p_service_id and workshop_id = appointment.workshop_id and active;
  if not found then raise exception 'Servicio no disponible'; end if;
  select * into settings from public.workshop_settings where workshop_id = appointment.workshop_id;
  if p_date < current_date then raise exception 'No puedes reprogramar a una fecha pasada'; end if;
  day_key := (array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[extract(dow from p_date)::integer + 1];
  hours := settings.business_hours -> day_key;
  if not coalesce((hours->>'open')::boolean,false) then raise exception 'El taller está cerrado ese día'; end if;
  if p_time < (hours->>'start')::time or p_time + make_interval(mins => service.duration_minutes) > (hours->>'end')::time then raise exception 'El servicio no cabe dentro del horario del taller'; end if;
  if exists (select 1 from public.schedule_blocks b where b.workshop_id = appointment.workshop_id and b.block_date = p_date and (b.all_day or (p_time < b.end_time and p_time + make_interval(mins => service.duration_minutes) > b.start_time))) then raise exception 'Ese horario está bloqueado'; end if;
  if exists (select 1 from public.appointments a where a.workshop_id = appointment.workshop_id and a.id <> appointment.id and a.appointment_date = p_date and a.status <> 'Cancelada' and p_time < a.appointment_time + make_interval(mins => a.duration_minutes) and p_time + make_interval(mins => service.duration_minutes) > a.appointment_time) then raise exception 'Ese horario se traslapa con otra cita'; end if;
  update public.appointments set service_id = service.id, service = service.name, duration_minutes = service.duration_minutes,
    appointment_date = p_date, appointment_time = p_time, status = case when status = 'Cancelada' then 'Pendiente' else status end
  where id = appointment.id;
  return true;
end;
$$;
revoke all on function public.reprogram_appointment(uuid,uuid,date,time) from public;
grant execute on function public.reprogram_appointment(uuid,uuid,date,time) to authenticated;
