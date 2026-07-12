-- HCM Workshop Manager
-- Entrega formal de motocicletas, firma de salida y cierre seguro de la OT.

alter table public.work_orders
drop constraint if exists work_orders_status_check;

alter table public.work_orders
add constraint work_orders_status_check
check (status in (
  'Recepción', 'Diagnóstico', 'Esperando aprobación',
  'Esperando repuestos', 'En reparación', 'Prueba',
  'Lista para entregar', 'Entregada', 'Cancelada'
));

create table if not exists public.work_order_deliveries (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id),
  work_order_id uuid not null unique
    references public.work_orders(id)
    on delete restrict,
  receiver_name text not null,
  receiver_identification text,
  mileage_out integer check (mileage_out is null or mileage_out >= 0),
  fuel_level_out text
    check (fuel_level_out is null or fuel_level_out in ('Vacío', '1/4', '1/2', '3/4', 'Lleno')),
  work_summary text not null,
  recommendations text,
  returned_items text,
  payment_condition text not null
    check (payment_condition in ('Pagado', 'Saldo pendiente autorizado', 'Sin factura')),
  customer_conformity boolean not null default true,
  delivery_notes text,
  delivered_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  delivered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists work_order_deliveries_workshop_index
on public.work_order_deliveries(workshop_id);

-- Permite conservar por separado la firma de recepción y la firma de entrega.
alter table public.work_order_signatures
add column if not exists signature_stage text not null default 'Recepción';

alter table public.work_order_signatures
drop constraint if exists work_order_signatures_signature_stage_check;

alter table public.work_order_signatures
add constraint work_order_signatures_signature_stage_check
check (signature_stage in ('Recepción', 'Entrega'));

alter table public.work_order_signatures
drop constraint if exists work_order_signatures_work_order_id_signer_type_key;

create unique index if not exists work_order_signatures_stage_unique
on public.work_order_signatures(work_order_id, signer_type, signature_stage);

create or replace function public.validate_work_order_delivery()
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

drop trigger if exists validate_delivery_workshop on public.work_order_deliveries;
create trigger validate_delivery_workshop
before insert or update on public.work_order_deliveries
for each row execute function public.validate_work_order_delivery();

alter table public.work_order_deliveries enable row level security;

create policy "Miembros leen entregas"
on public.work_order_deliveries
for select to authenticated
using (public.is_workshop_member(workshop_id));

create policy "Recepcion gestiona entregas"
on public.work_order_deliveries
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create or replace function public.complete_work_order_delivery(
  p_work_order_id uuid,
  p_receiver_name text,
  p_receiver_identification text,
  p_mileage_out integer,
  p_fuel_level_out text,
  p_work_summary text,
  p_recommendations text,
  p_returned_items text,
  p_payment_condition text,
  p_customer_conformity boolean,
  p_delivery_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.work_orders%rowtype;
  delivery_id uuid;
  pending_balance numeric(12,2);
begin
  select * into target_order
  from public.work_orders
  where id = p_work_order_id
  for update;

  if not found then raise exception 'Orden de trabajo no encontrada'; end if;

  if not public.has_workshop_role(
    target_order.workshop_id,
    array['owner','admin','reception']
  ) then
    raise exception 'No tienes permiso para entregar motocicletas';
  end if;

  if target_order.status not in ('Lista para entregar', 'Prueba') then
    raise exception 'La orden debe estar lista para entregar';
  end if;

  if trim(coalesce(p_receiver_name, '')) = '' then
    raise exception 'El nombre de quien recibe es obligatorio';
  end if;

  if trim(coalesce(p_work_summary, '')) = '' then
    raise exception 'El resumen del trabajo es obligatorio';
  end if;

  select coalesce(sum(total - amount_paid), 0)
  into pending_balance
  from public.invoices
  where work_order_id = p_work_order_id
    and status <> 'Anulada';

  if pending_balance > 0
     and p_payment_condition <> 'Saldo pendiente autorizado' then
    raise exception 'La orden tiene un saldo pendiente de %', pending_balance;
  end if;

  insert into public.work_order_deliveries (
    workshop_id,
    work_order_id,
    receiver_name,
    receiver_identification,
    mileage_out,
    fuel_level_out,
    work_summary,
    recommendations,
    returned_items,
    payment_condition,
    customer_conformity,
    delivery_notes
  ) values (
    target_order.workshop_id,
    p_work_order_id,
    trim(p_receiver_name),
    nullif(trim(coalesce(p_receiver_identification, '')), ''),
    p_mileage_out,
    p_fuel_level_out,
    trim(p_work_summary),
    nullif(trim(coalesce(p_recommendations, '')), ''),
    nullif(trim(coalesce(p_returned_items, '')), ''),
    p_payment_condition,
    coalesce(p_customer_conformity, true),
    nullif(trim(coalesce(p_delivery_notes, '')), '')
  )
  returning id into delivery_id;

  update public.work_orders
  set
    status = 'Entregada',
    delivered_at = now(),
    updated_at = now()
  where id = p_work_order_id;

  if p_mileage_out is not null then
    update public.motorcycles
    set mileage = greatest(coalesce(mileage, 0), p_mileage_out)
    where id = target_order.motorcycle_id
      and workshop_id = target_order.workshop_id;
  end if;

  return delivery_id;
end;
$$;

revoke all on function public.complete_work_order_delivery(
  uuid, text, text, integer, text, text, text, text, text, boolean, text
) from public;

grant execute on function public.complete_work_order_delivery(
  uuid, text, text, integer, text, text, text, text, text, boolean, text
) to authenticated;
