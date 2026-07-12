-- HCM Workshop Manager
-- Facturación interna, líneas y registro auditable de pagos.

create sequence if not exists public.invoice_number_seq;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id),
  invoice_number text not null unique,
  work_order_id uuid not null unique
    references public.work_orders(id)
    on delete restrict,
  quote_id uuid unique
    references public.quotes(id)
    on delete set null,
  status text not null default 'Pendiente'
    check (status in ('Pendiente', 'Parcial', 'Pagada', 'Anulada')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  tax_rate numeric(5,2) not null default 13 check (tax_rate >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  notes text,
  issued_at timestamptz not null default now(),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id),
  invoice_id uuid not null
    references public.invoices(id)
    on delete cascade,
  product_id uuid
    references public.inventory_products(id)
    on delete set null,
  item_type text not null default 'Repuesto'
    check (item_type in ('Mano de obra', 'Repuesto', 'Otro')),
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2)
    generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id),
  invoice_id uuid not null
    references public.invoices(id)
    on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null
    check (payment_method in ('Efectivo', 'SINPE', 'Tarjeta', 'Transferencia', 'Otro')),
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists invoices_workshop_index on public.invoices(workshop_id);
create index if not exists invoice_items_invoice_index on public.invoice_items(invoice_id);
create index if not exists invoice_items_workshop_index on public.invoice_items(workshop_id);
create index if not exists invoice_payments_invoice_index on public.invoice_payments(invoice_id);
create index if not exists invoice_payments_workshop_index on public.invoice_payments(workshop_id);

create or replace function public.generate_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number :=
      'F-' ||
      to_char(current_date, 'YYYY') ||
      '-' ||
      lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_number on public.invoices;
create trigger set_invoice_number
before insert on public.invoices
for each row execute function public.generate_invoice_number();

create or replace function public.validate_invoice_workshop_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'invoices' then
    if not exists (
      select 1 from public.work_orders
      where id = new.work_order_id and workshop_id = new.workshop_id
    ) then raise exception 'La OT pertenece a otro taller'; end if;
    if new.quote_id is not null and not exists (
      select 1 from public.quotes
      where id = new.quote_id and workshop_id = new.workshop_id
    ) then raise exception 'El presupuesto pertenece a otro taller'; end if;
  elsif tg_table_name = 'invoice_items' then
    if not exists (
      select 1 from public.invoices
      where id = new.invoice_id and workshop_id = new.workshop_id
    ) then raise exception 'La factura pertenece a otro taller'; end if;
    if new.product_id is not null and not exists (
      select 1 from public.inventory_products
      where id = new.product_id and workshop_id = new.workshop_id
    ) then raise exception 'El producto pertenece a otro taller'; end if;
  elsif tg_table_name = 'invoice_payments' then
    if not exists (
      select 1 from public.invoices
      where id = new.invoice_id and workshop_id = new.workshop_id
    ) then raise exception 'La factura pertenece a otro taller'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_invoice_workshop on public.invoices;
create trigger validate_invoice_workshop
before insert or update on public.invoices
for each row execute function public.validate_invoice_workshop_links();

drop trigger if exists validate_invoice_item_workshop on public.invoice_items;
create trigger validate_invoice_item_workshop
before insert or update on public.invoice_items
for each row execute function public.validate_invoice_workshop_links();

drop trigger if exists validate_invoice_payment_workshop on public.invoice_payments;
create trigger validate_invoice_payment_workshop
before insert on public.invoice_payments
for each row execute function public.validate_invoice_workshop_links();

create or replace function public.apply_invoice_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_total numeric(12,2);
  current_paid numeric(12,2);
  invoice_status text;
  next_paid numeric(12,2);
begin
  select total, amount_paid, status
  into invoice_total, current_paid, invoice_status
  from public.invoices
  where id = new.invoice_id and workshop_id = new.workshop_id
  for update;

  if not found then raise exception 'Factura no encontrada'; end if;
  if invoice_status = 'Anulada' then raise exception 'No se puede pagar una factura anulada'; end if;

  next_paid := current_paid + new.amount;
  if next_paid > invoice_total then
    raise exception 'El pago supera el saldo pendiente de %', invoice_total - current_paid;
  end if;

  update public.invoices
  set
    amount_paid = next_paid,
    status = case when next_paid = invoice_total then 'Pagada' else 'Parcial' end,
    paid_at = case when next_paid = invoice_total then new.paid_at else null end,
    updated_at = now()
  where id = new.invoice_id;

  return new;
end;
$$;

drop trigger if exists update_invoice_balance on public.invoice_payments;
create trigger update_invoice_balance
before insert on public.invoice_payments
for each row execute function public.apply_invoice_payment();

create or replace function public.create_invoice_from_quote(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  new_invoice_id uuid;
begin
  select * into q from public.quotes where id = p_quote_id;
  if not found then raise exception 'Presupuesto no encontrado'; end if;
  if q.status <> 'Aprobado' then raise exception 'El presupuesto debe estar aprobado'; end if;
  if not public.has_workshop_role(q.workshop_id, array['owner','admin','reception']) then
    raise exception 'No tienes permiso para facturar';
  end if;

  insert into public.invoices (
    workshop_id, invoice_number, work_order_id, quote_id,
    subtotal, discount, tax_rate, tax_amount, total, notes
  ) values (
    q.workshop_id, '', q.work_order_id, q.id,
    q.subtotal, q.discount, q.tax_rate, q.tax_amount, q.total, q.notes
  ) returning id into new_invoice_id;

  insert into public.invoice_items (
    workshop_id, invoice_id, product_id, item_type,
    description, quantity, unit_price
  )
  select
    q.workshop_id, new_invoice_id, product_id, item_type,
    description, quantity, unit_price
  from public.quote_items
  where quote_id = q.id;

  return new_invoice_id;
end;
$$;

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_payments enable row level security;

create policy "Miembros leen facturas" on public.invoices
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Administracion gestiona facturas" on public.invoices
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create policy "Miembros leen lineas de factura" on public.invoice_items
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Administracion gestiona lineas de factura" on public.invoice_items
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create policy "Miembros leen pagos" on public.invoice_payments
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Administracion registra pagos" on public.invoice_payments
for insert to authenticated
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

revoke all on function public.create_invoice_from_quote(uuid) from public;
grant execute on function public.create_invoice_from_quote(uuid) to authenticated;
