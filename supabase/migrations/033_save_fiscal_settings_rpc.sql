-- Guardado directo y seguro de la configuración fiscal del taller actual.

create or replace function public.save_my_fiscal_settings(p_settings jsonb)
returns public.fiscal_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workshop_id uuid;
  saved public.fiscal_settings%rowtype;
begin
  target_workshop_id := public.current_workshop_id();
  if target_workshop_id is null then
    raise exception 'No hay un taller activo';
  end if;
  if not public.has_workshop_role(target_workshop_id, array['owner','admin']) then
    raise exception 'No tienes permiso para modificar los datos fiscales';
  end if;

  update public.fiscal_settings
  set
    environment = coalesce(nullif(p_settings->>'environment', ''), environment),
    issuer_name = trim(p_settings->>'issuer_name'),
    identification_type = p_settings->>'identification_type',
    identification_number = regexp_replace(p_settings->>'identification_number', '[^0-9]', '', 'g'),
    economic_activity_code = regexp_replace(p_settings->>'economic_activity_code', '[^0-9]', '', 'g'),
    economic_activity_name = nullif(trim(p_settings->>'economic_activity_name'), ''),
    province_code = p_settings->>'province_code',
    canton_code = lpad(p_settings->>'canton_code', 2, '0'),
    district_code = lpad(p_settings->>'district_code', 2, '0'),
    neighborhood_code = nullif(lpad(coalesce(p_settings->>'neighborhood_code', ''), 2, '0'), '00'),
    other_signs = trim(p_settings->>'other_signs'),
    phone_country_code = regexp_replace(p_settings->>'phone_country_code', '[^0-9]', '', 'g'),
    phone_number = regexp_replace(p_settings->>'phone_number', '[^0-9]', '', 'g'),
    email = lower(trim(p_settings->>'email')),
    branch_code = lpad(p_settings->>'branch_code', 3, '0'),
    terminal_code = lpad(p_settings->>'terminal_code', 5, '0'),
    last_invoice_consecutive = coalesce((p_settings->>'last_invoice_consecutive')::bigint, last_invoice_consecutive),
    default_labor_cabys = nullif(regexp_replace(coalesce(p_settings->>'default_labor_cabys', ''), '[^0-9]', '', 'g'), ''),
    default_parts_cabys = nullif(regexp_replace(coalesce(p_settings->>'default_parts_cabys', ''), '[^0-9]', '', 'g'), ''),
    enabled = false,
    updated_at = now()
  where workshop_id = target_workshop_id
  returning * into saved;

  if not found then
    raise exception 'No existe la configuración fiscal del taller';
  end if;
  return saved;
end;
$$;

revoke all on function public.save_my_fiscal_settings(jsonb) from public;
grant execute on function public.save_my_fiscal_settings(jsonb) to authenticated;

