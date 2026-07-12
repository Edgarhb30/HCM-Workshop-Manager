-- HCM Workshop Manager
-- Módulo de presupuestos vinculados a órdenes de trabajo

create sequence if not exists public.quote_number_seq;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  work_order_id uuid not null unique
    references public.work_orders(id)
    on delete cascade,
  status text not null default 'Borrador'
    check (status in ('Borrador', 'Enviado', 'Aprobado', 'Rechazado')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  tax_rate numeric(5,2) not null default 13 check (tax_rate >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  notes text,
  valid_until date,
  sent_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null
    references public.quotes(id)
    on delete cascade,
  item_type text not null default 'Repuesto'
    check (item_type in ('Mano de obra', 'Repuesto', 'Otro')),
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2)
    generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create index if not exists quotes_work_order_id_index
on public.quotes(work_order_id);

create index if not exists quote_items_quote_id_index
on public.quote_items(quote_id);

create or replace function public.generate_quote_number()
returns trigger
language plpgsql
as $$
begin
  if new.quote_number is null or new.quote_number = '' then
    new.quote_number :=
      'P-' ||
      to_char(current_date, 'YYYY') ||
      '-' ||
      lpad(nextval('public.quote_number_seq')::text, 6, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists set_quote_number on public.quotes;

create trigger set_quote_number
before insert on public.quotes
for each row
execute function public.generate_quote_number();

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

drop policy if exists "Administrador gestiona presupuestos"
on public.quotes;

create policy "Administrador gestiona presupuestos"
on public.quotes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Administrador gestiona lineas de presupuesto"
on public.quote_items;

create policy "Administrador gestiona lineas de presupuesto"
on public.quote_items
for all
to authenticated
using (true)
with check (true);
