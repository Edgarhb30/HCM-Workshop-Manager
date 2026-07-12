-- HCM Workshop Manager
-- Línea de tiempo segura para el portal Mi moto.

create or replace function public.get_client_timeline(
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
      'id', event.id,
      'work_order_id', event.work_order_id,
      'order_number', wo.order_number,
      'motorcycle_id', wo.motorcycle_id,
      'event_type', event.event_type,
      'title', event.title,
      'description', event.description,
      'status', event.status,
      'created_at', event.created_at
    ) order by event.created_at desc)
    from public.work_order_events event
    join public.work_orders wo on wo.id = event.work_order_id
    where event.workshop_id = access_record.workshop_id
      and wo.customer_id = access_record.customer_id
      and event.client_visible = true
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_client_timeline(text) from public;
grant execute on function public.get_client_timeline(text) to authenticated;
