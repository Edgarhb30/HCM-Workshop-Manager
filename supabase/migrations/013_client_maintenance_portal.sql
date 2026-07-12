-- HCM Workshop Manager
-- Historial de mantenimiento seguro para el portal del cliente.

create or replace function public.get_client_maintenance(
  p_workshop_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  access_record public.customer_portal_access%rowtype;
begin
  select cpa.* into access_record
  from public.customer_portal_access cpa
  join public.workshops w on w.id = cpa.workshop_id
  where cpa.user_id = auth.uid()
    and cpa.active = true
    and w.slug = p_workshop_slug
    and w.active = true;

  if not found then
    raise exception 'No tienes acceso al expediente de este taller';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', mr.id,
      'motorcycle_id', mr.motorcycle_id,
      'service_type', mr.service_type,
      'service_date', mr.service_date,
      'mileage', mr.mileage,
      'details', mr.details,
      'parts_used', mr.parts_used,
      'next_service_mileage', mr.next_service_mileage,
      'next_service_date', mr.next_service_date
    ) order by mr.service_date desc, mr.created_at desc)
    from public.maintenance_records mr
    join public.motorcycles m on m.id = mr.motorcycle_id
    where mr.workshop_id = access_record.workshop_id
      and m.customer_id = access_record.customer_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_client_maintenance(text) from public;
grant execute on function public.get_client_maintenance(text) to authenticated;
