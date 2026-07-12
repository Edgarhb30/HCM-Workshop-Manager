-- HCM Workshop Manager 1.1
-- Consecutivo inicial de factura electrónica.

alter table public.fiscal_settings
add column if not exists last_invoice_consecutive bigint not null default 0
check (last_invoice_consecutive between 0 and 9999999998);

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
  initial_last_number bigint;
begin
  select * into target_invoice from public.invoices where id = p_invoice_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  if not public.has_workshop_role(target_invoice.workshop_id, array['owner','admin','reception']) then
    raise exception 'No tienes permiso para emitir comprobantes';
  end if;
  select * into settings from public.fiscal_settings where workshop_id = target_invoice.workshop_id;
  if not found then raise exception 'Falta la configuración fiscal del taller'; end if;
  if p_document_type not in ('01','02','03','04','08','09','10') then raise exception 'Tipo de comprobante inválido'; end if;

  initial_last_number := case when p_document_type = '01' then settings.last_invoice_consecutive else 0 end;

  insert into public.fiscal_sequences (workshop_id, branch_code, terminal_code, document_type, next_number)
  values (target_invoice.workshop_id, settings.branch_code, settings.terminal_code, p_document_type, initial_last_number + 2)
  on conflict (workshop_id, branch_code, terminal_code, document_type)
  do update set next_number = public.fiscal_sequences.next_number + 1
  returning next_number - 1 into reserved_number;

  return settings.branch_code || settings.terminal_code || p_document_type || lpad(reserved_number::text, 10, '0');
end;
$$;

revoke all on function public.reserve_fiscal_consecutive(uuid, text) from public;
grant execute on function public.reserve_fiscal_consecutive(uuid, text) to authenticated;

