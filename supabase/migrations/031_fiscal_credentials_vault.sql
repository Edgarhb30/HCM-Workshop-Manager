-- HCM Workshop Manager 1.1
-- Credenciales fiscales cifradas con Supabase Vault.

create extension if not exists supabase_vault with schema vault;

create table if not exists public.fiscal_secret_refs (
  workshop_id uuid primary key references public.workshops(id) on delete cascade,
  api_username_secret_id uuid not null,
  api_password_secret_id uuid not null,
  signing_key_secret_id uuid not null,
  signing_pin_secret_id uuid not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.fiscal_secret_refs enable row level security;

-- El navegador solo puede saber que existe configuración, nunca leer referencias ni secretos.
revoke all on table public.fiscal_secret_refs from anon, authenticated;
revoke all on table vault.secrets from anon, authenticated;
revoke all on table vault.decrypted_secrets from anon, authenticated;

create or replace function public.save_my_fiscal_credentials(
  p_api_username text,
  p_api_password text,
  p_signing_key_base64 text,
  p_signing_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  wid uuid;
  refs public.fiscal_secret_refs%rowtype;
  username_id uuid;
  password_id uuid;
  key_id uuid;
  pin_id uuid;
begin
  wid := public.current_workshop_id();
  if wid is null or not public.has_workshop_role(wid, array['owner','admin']) then
    raise exception 'No tienes permiso para configurar credenciales fiscales';
  end if;
  if length(trim(coalesce(p_api_username, ''))) < 8 then raise exception 'Usuario de Hacienda inválido'; end if;
  if length(coalesce(p_api_password, '')) < 4 then raise exception 'Contraseña de Hacienda inválida'; end if;
  if length(coalesce(p_signing_key_base64, '')) < 500 then raise exception 'La llave .p12 no es válida'; end if;
  if length(coalesce(p_signing_pin, '')) < 4 then raise exception 'PIN de la llave inválido'; end if;

  select * into refs from public.fiscal_secret_refs where workshop_id = wid for update;

  if found then
    perform vault.update_secret(refs.api_username_secret_id, trim(p_api_username));
    perform vault.update_secret(refs.api_password_secret_id, p_api_password);
    perform vault.update_secret(refs.signing_key_secret_id, p_signing_key_base64);
    perform vault.update_secret(refs.signing_pin_secret_id, p_signing_pin);
  else
    username_id := vault.create_secret(trim(p_api_username));
    password_id := vault.create_secret(p_api_password);
    key_id := vault.create_secret(p_signing_key_base64);
    pin_id := vault.create_secret(p_signing_pin);
    insert into public.fiscal_secret_refs (
      workshop_id, api_username_secret_id, api_password_secret_id,
      signing_key_secret_id, signing_pin_secret_id, updated_by
    ) values (wid, username_id, password_id, key_id, pin_id, auth.uid());
  end if;

  update public.fiscal_secret_refs set updated_by = auth.uid(), updated_at = now() where workshop_id = wid;
  update public.fiscal_settings
  set credentials_configured = true, signing_key_configured = true, updated_at = now()
  where workshop_id = wid;
  return true;
end;
$$;

-- Esta función queda reservada exclusivamente para el servidor emisor.
create or replace function public.get_fiscal_credentials_for_server(p_workshop_id uuid)
returns table (api_username text, api_password text, signing_key_base64 text, signing_pin text)
language sql
security definer
set search_path = public, vault
as $$
  select u.decrypted_secret, p.decrypted_secret, k.decrypted_secret, n.decrypted_secret
  from public.fiscal_secret_refs r
  join vault.decrypted_secrets u on u.id = r.api_username_secret_id
  join vault.decrypted_secrets p on p.id = r.api_password_secret_id
  join vault.decrypted_secrets k on k.id = r.signing_key_secret_id
  join vault.decrypted_secrets n on n.id = r.signing_pin_secret_id
  where r.workshop_id = p_workshop_id;
$$;

revoke all on function public.save_my_fiscal_credentials(text,text,text,text) from public;
grant execute on function public.save_my_fiscal_credentials(text,text,text,text) to authenticated;
revoke all on function public.get_fiscal_credentials_for_server(uuid) from public, anon, authenticated;
grant execute on function public.get_fiscal_credentials_for_server(uuid) to service_role;

