-- HCM Workshop Manager 1.1
-- Base multi-taller para comprobantes electrónicos de Costa Rica v4.4.
-- Las credenciales, PIN y llave .p12 NO se almacenan en estas tablas.

create table if not exists public.fiscal_settings (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null unique default public.current_workshop_id()
    references public.workshops(id) on delete cascade,
  environment text not null default 'test'
    check (environment in ('test', 'production')),
  issuer_name text not null,
  identification_type text not null default '01'
    check (identification_type in ('01', '02', '03', '04')),
  identification_number text not null,
  economic_activity_code text not null,
  economic_activity_name text,
  province_code text not null check (province_code ~ '^[1-7]$'),
  canton_code text not null check (canton_code ~ '^[0-9]{2}$'),
  district_code text not null check (district_code ~ '^[0-9]{2}$'),
  neighborhood_code text check (neighborhood_code is null or neighborhood_code ~ '^[0-9]{2}$'),
  other_signs text not null,
  phone_country_code text not null default '506',
  phone_number text not null,
  email text not null,
  branch_code text not null default '001' check (branch_code ~ '^[0-9]{3}$'),
  terminal_code text not null default '00001' check (terminal_code ~ '^[0-9]{5}$'),
  default_labor_cabys text,
  default_parts_cabys text,
  enabled boolean not null default false,
  credentials_configured boolean not null default false,
  signing_key_configured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fiscal_sequences (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id) on delete cascade,
  branch_code text not null check (branch_code ~ '^[0-9]{3}$'),
  terminal_code text not null check (terminal_code ~ '^[0-9]{5}$'),
  document_type text not null check (document_type in ('01','02','03','04','08','09','10')),
  next_number bigint not null default 1 check (next_number between 1 and 9999999999),
  unique (workshop_id, branch_code, terminal_code, document_type)
);

create table if not exists public.electronic_documents (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete restrict,
  document_type text not null check (document_type in ('01','02','03','04','08','09','10')),
  fiscal_key text unique check (fiscal_key is null or fiscal_key ~ '^[0-9]{50}$'),
  consecutive text check (consecutive is null or consecutive ~ '^[0-9]{20}$'),
  status text not null default 'Borrador'
    check (status in ('Borrador','Firmando','Enviado','Aceptado','Rechazado','Error','Anulado')),
  currency text not null default 'CRC',
  exchange_rate numeric(18,5),
  xml_unsigned_path text,
  xml_signed_path text,
  hacienda_response_path text,
  pdf_path text,
  hacienda_message text,
  submitted_at timestamptz,
  answered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, invoice_id, document_type)
);

create index if not exists fiscal_settings_workshop_idx on public.fiscal_settings(workshop_id);
create index if not exists fiscal_sequences_workshop_idx on public.fiscal_sequences(workshop_id);
create index if not exists electronic_documents_workshop_idx on public.electronic_documents(workshop_id);
create index if not exists electronic_documents_invoice_idx on public.electronic_documents(invoice_id);
create index if not exists electronic_documents_status_idx on public.electronic_documents(workshop_id, status);

alter table public.fiscal_settings enable row level security;
alter table public.fiscal_sequences enable row level security;
alter table public.electronic_documents enable row level security;

create policy "Miembros leen configuracion fiscal" on public.fiscal_settings
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Administradores gestionan configuracion fiscal" on public.fiscal_settings
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']))
with check (public.has_workshop_role(workshop_id, array['owner','admin']));

create policy "Administradores leen consecutivos fiscales" on public.fiscal_sequences
for select to authenticated using (public.has_workshop_role(workshop_id, array['owner','admin']));

create policy "Miembros leen comprobantes electronicos" on public.electronic_documents
for select to authenticated using (public.is_workshop_member(workshop_id));
create policy "Administracion gestiona comprobantes electronicos" on public.electronic_documents
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

create or replace function public.reserve_fiscal_consecutive(
  p_invoice_id uuid,
  p_document_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invoice public.invoices%rowtype;
  settings public.fiscal_settings%rowtype;
  reserved_number bigint;
begin
  select * into target_invoice from public.invoices where id = p_invoice_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  if not public.has_workshop_role(target_invoice.workshop_id, array['owner','admin','reception']) then
    raise exception 'No tienes permiso para emitir comprobantes';
  end if;
  select * into settings from public.fiscal_settings where workshop_id = target_invoice.workshop_id;
  if not found then raise exception 'Falta la configuración fiscal del taller'; end if;
  if p_document_type not in ('01','02','03','04','08','09','10') then raise exception 'Tipo de comprobante inválido'; end if;

  insert into public.fiscal_sequences (workshop_id, branch_code, terminal_code, document_type, next_number)
  values (target_invoice.workshop_id, settings.branch_code, settings.terminal_code, p_document_type, 2)
  on conflict (workshop_id, branch_code, terminal_code, document_type)
  do update set next_number = public.fiscal_sequences.next_number + 1
  returning next_number - 1 into reserved_number;

  return settings.branch_code || settings.terminal_code || p_document_type || lpad(reserved_number::text, 10, '0');
end;
$$;

revoke all on function public.reserve_fiscal_consecutive(uuid, text) from public;
grant execute on function public.reserve_fiscal_consecutive(uuid, text) to authenticated;

