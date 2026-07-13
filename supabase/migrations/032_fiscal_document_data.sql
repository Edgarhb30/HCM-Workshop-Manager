-- HCM Workshop Manager 1.1
-- Datos requeridos para preparar XML v4.4 sin consumir consecutivos fiscales.

alter table public.customers
  add column if not exists fiscal_identification_type text,
  add column if not exists fiscal_identification_number text,
  add column if not exists fiscal_economic_activity_code text;

alter table public.customers
  drop constraint if exists customers_fiscal_identification_type_check,
  add constraint customers_fiscal_identification_type_check
    check (fiscal_identification_type is null or fiscal_identification_type in ('01','02','03','04')),
  drop constraint if exists customers_fiscal_identification_number_check,
  add constraint customers_fiscal_identification_number_check
    check (fiscal_identification_number is null or fiscal_identification_number ~ '^[0-9]{9,12}$'),
  drop constraint if exists customers_fiscal_economic_activity_code_check,
  add constraint customers_fiscal_economic_activity_code_check
    check (fiscal_economic_activity_code is null or fiscal_economic_activity_code ~ '^[0-9]{6}$');

alter table public.invoice_items
  add column if not exists cabys_code text,
  add column if not exists unit_code text not null default 'Sp',
  add column if not exists tax_code text not null default '01',
  add column if not exists tax_rate_code text not null default '08',
  add column if not exists fiscal_tax_rate numeric(5,2) not null default 13;

alter table public.invoice_items
  drop constraint if exists invoice_items_cabys_code_check,
  add constraint invoice_items_cabys_code_check
    check (cabys_code is null or cabys_code ~ '^[0-9]{13}$'),
  drop constraint if exists invoice_items_unit_code_check,
  add constraint invoice_items_unit_code_check
    check (unit_code in ('Sp','Unid','h','d','kg','g','L','mL','m','cm','mm')),
  drop constraint if exists invoice_items_tax_code_check,
  add constraint invoice_items_tax_code_check
    check (tax_code = '01'),
  drop constraint if exists invoice_items_tax_rate_code_check,
  add constraint invoice_items_tax_rate_code_check
    check (tax_rate_code in ('01','02','03','04','05','06','07','08','09','10','11')),
  drop constraint if exists invoice_items_fiscal_tax_rate_check,
  add constraint invoice_items_fiscal_tax_rate_check
    check (fiscal_tax_rate in (0, 0.5, 1, 2, 4, 8, 13));

-- Completa CABYS por defecto en facturas existentes cuando el taller ya lo configuró.
update public.invoice_items item
set cabys_code = case
  when item.item_type = 'Mano de obra' then settings.default_labor_cabys
  else settings.default_parts_cabys
end
from public.fiscal_settings settings
where settings.workshop_id = item.workshop_id
  and item.cabys_code is null
  and case
    when item.item_type = 'Mano de obra' then settings.default_labor_cabys
    else settings.default_parts_cabys
  end ~ '^[0-9]{13}$';

-- Las líneas nuevas toman automáticamente el CABYS fiscal configurado por el taller.
create or replace function public.set_invoice_item_fiscal_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.fiscal_settings%rowtype;
begin
  if new.cabys_code is null then
    select * into settings
    from public.fiscal_settings
    where workshop_id = new.workshop_id;

    if found then
      new.cabys_code := case
        when new.item_type = 'Mano de obra' then settings.default_labor_cabys
        else settings.default_parts_cabys
      end;
    end if;
  end if;

  new.unit_code := coalesce(nullif(new.unit_code, ''), case when new.item_type = 'Mano de obra' then 'Sp' else 'Unid' end);
  return new;
end;
$$;

drop trigger if exists set_invoice_item_fiscal_defaults on public.invoice_items;
create trigger set_invoice_item_fiscal_defaults
before insert or update of item_type, cabys_code, unit_code
on public.invoice_items
for each row execute function public.set_invoice_item_fiscal_defaults();

