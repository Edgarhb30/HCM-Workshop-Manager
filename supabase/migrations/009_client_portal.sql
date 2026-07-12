-- HCM Workshop Manager
-- Acceso seguro al Portal del Cliente mediante Supabase Auth.

create table if not exists public.customer_portal_access (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null
    references public.workshops(id)
    on delete cascade,
  customer_id uuid not null
    references public.customers(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  active boolean not null default true,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workshop_id, customer_id),
  unique (workshop_id, user_id)
);

create index if not exists customer_portal_access_user_index
on public.customer_portal_access(user_id, workshop_id);

alter table public.customer_portal_access enable row level security;

create policy "Cliente ve su acceso"
on public.customer_portal_access
for select to authenticated
using (user_id = auth.uid() and active = true);

create policy "Administradores ven accesos de clientes"
on public.customer_portal_access
for select to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create or replace function public.claim_customer_portal(
  p_workshop_slug text,
  p_phone text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workshop_id uuid;
  target_customer_id uuid;
  authenticated_email text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión primero';
  end if;

  authenticated_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if authenticated_email = '' then
    raise exception 'La cuenta no tiene correo verificado';
  end if;

  select id into target_workshop_id
  from public.workshops
  where slug = p_workshop_slug and active = true;

  if not found then raise exception 'Taller no encontrado'; end if;

  select id into target_customer_id
  from public.customers
  where workshop_id = target_workshop_id
    and lower(coalesce(email, '')) = authenticated_email
    and regexp_replace(phone, '[^0-9]', '', 'g') =
        regexp_replace(p_phone, '[^0-9]', '', 'g')
  limit 1;

  if not found then
    raise exception 'El correo y teléfono no coinciden con un cliente registrado';
  end if;

  insert into public.customer_portal_access (
    workshop_id,
    customer_id,
    user_id,
    active,
    verified_at
  ) values (
    target_workshop_id,
    target_customer_id,
    auth.uid(),
    true,
    now()
  )
  on conflict (workshop_id, customer_id) do update
  set
    user_id = excluded.user_id,
    active = true,
    verified_at = now();

  return true;
end;
$$;

create or replace function public.get_client_portal_data(
  p_workshop_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  access_record public.customer_portal_access%rowtype;
  result jsonb;
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

  select jsonb_build_object(
    'workshop', (
      select jsonb_build_object(
        'name', w.name,
        'slug', w.slug,
        'phone', ws.phone,
        'whatsapp', ws.whatsapp,
        'email', ws.email,
        'address', ws.address,
        'logo_url', ws.logo_url
      )
      from public.workshops w
      left join public.workshop_settings ws on ws.workshop_id = w.id
      where w.id = access_record.workshop_id
    ),
    'customer', (
      select jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'phone', c.phone,
        'email', c.email
      )
      from public.customers c
      where c.id = access_record.customer_id
    ),
    'motorcycles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'brand', m.brand,
        'model', m.model,
        'year', m.motorcycle_year,
        'plate', m.plate,
        'color', m.color,
        'mileage', m.mileage
      ) order by m.brand, m.model)
      from public.motorcycles m
      where m.workshop_id = access_record.workshop_id
        and m.customer_id = access_record.customer_id
    ), '[]'::jsonb),
    'work_orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', wo.id,
        'order_number', wo.order_number,
        'motorcycle_id', wo.motorcycle_id,
        'status', wo.status,
        'mileage', wo.mileage,
        'reason', wo.intake_notes,
        'received_at', wo.received_at,
        'delivered_at', wo.delivered_at
      ) order by wo.received_at desc)
      from public.work_orders wo
      where wo.workshop_id = access_record.workshop_id
        and wo.customer_id = access_record.customer_id
        and wo.status <> 'Cancelada'
    ), '[]'::jsonb),
    'oil_changes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oc.id,
        'motorcycle_id', oc.motorcycle_id,
        'change_date', oc.change_date,
        'mileage', oc.mileage,
        'oil_brand', oc.oil_brand,
        'oil_viscosity', oc.oil_viscosity,
        'filter_changed', oc.filter_changed,
        'next_change_mileage', oc.next_change_mileage,
        'next_change_date', oc.next_change_date
      ) order by oc.change_date desc)
      from public.oil_changes oc
      join public.motorcycles m on m.id = oc.motorcycle_id
      where oc.workshop_id = access_record.workshop_id
        and m.customer_id = access_record.customer_id
    ), '[]'::jsonb),
    'quotes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'quote_number', q.quote_number,
        'work_order_id', q.work_order_id,
        'status', q.status,
        'total', q.total,
        'valid_until', q.valid_until,
        'created_at', q.created_at
      ) order by q.created_at desc)
      from public.quotes q
      join public.work_orders wo on wo.id = q.work_order_id
      where q.workshop_id = access_record.workshop_id
        and wo.customer_id = access_record.customer_id
        and q.status in ('Enviado', 'Aprobado', 'Rechazado')
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'invoice_number', i.invoice_number,
        'work_order_id', i.work_order_id,
        'status', i.status,
        'total', i.total,
        'amount_paid', i.amount_paid,
        'issued_at', i.issued_at
      ) order by i.issued_at desc)
      from public.invoices i
      join public.work_orders wo on wo.id = i.work_order_id
      where i.workshop_id = access_record.workshop_id
        and wo.customer_id = access_record.customer_id
        and i.status <> 'Anulada'
    ), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', a.appointment_date,
        'time', a.appointment_time,
        'service', a.service,
        'status', a.status,
        'brand', a.brand,
        'model', a.model
      ) order by a.appointment_date desc, a.appointment_time desc)
      from public.appointments a
      join public.customers c on c.id = access_record.customer_id
      where a.workshop_id = access_record.workshop_id
        and regexp_replace(a.phone, '[^0-9]', '', 'g') =
            regexp_replace(c.phone, '[^0-9]', '', 'g')
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.claim_customer_portal(text, text) from public;
grant execute on function public.claim_customer_portal(text, text) to authenticated;
revoke all on function public.get_client_portal_data(text) from public;
grant execute on function public.get_client_portal_data(text) to authenticated;
