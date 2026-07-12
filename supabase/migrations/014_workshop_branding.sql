-- HCM Workshop Manager
-- Identidad visual editable y aislada por taller.

alter table public.workshop_settings
add column if not exists theme_mode text not null default 'light';

alter table public.workshop_settings
add column if not exists primary_color text not null default '#232323';

alter table public.workshop_settings
add column if not exists accent_color text not null default '#686868';

alter table public.workshop_settings
add column if not exists background_color text not null default '#f3f4f5';

alter table public.workshop_settings
add column if not exists surface_color text not null default '#ffffff';

alter table public.workshop_settings
add column if not exists text_color text not null default '#191919';

alter table public.workshop_settings
drop constraint if exists workshop_settings_theme_mode_check;

alter table public.workshop_settings
add constraint workshop_settings_theme_mode_check
check (theme_mode in ('light', 'dark'));

alter table public.workshop_settings
drop constraint if exists workshop_settings_brand_colors_check;

alter table public.workshop_settings
add constraint workshop_settings_brand_colors_check
check (
  primary_color ~ '^#[0-9A-Fa-f]{6}$'
  and accent_color ~ '^#[0-9A-Fa-f]{6}$'
  and background_color ~ '^#[0-9A-Fa-f]{6}$'
  and surface_color ~ '^#[0-9A-Fa-f]{6}$'
  and text_color ~ '^#[0-9A-Fa-f]{6}$'
);

-- Paleta inicial de Herrera Custom Motorcycle: blanco, gris y negro.
update public.workshop_settings ws
set
  theme_mode = 'light',
  primary_color = '#222222',
  accent_color = '#666666',
  background_color = '#f1f2f3',
  surface_color = '#ffffff',
  text_color = '#181818',
  updated_at = now()
from public.workshops w
where ws.workshop_id = w.id
  and w.slug = 'herrera-custom-motorcycle';

-- La agenda pública recibe solamente datos visuales no sensibles.
create or replace function public.get_public_workshop_config(p_workshop_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', w.name,
    'slug', w.slug,
    'timezone', w.timezone,
    'phone', ws.phone,
    'whatsapp', ws.whatsapp,
    'email', ws.email,
    'address', ws.address,
    'logo_url', ws.logo_url,
    'appointment_slot_minutes', ws.appointment_slot_minutes,
    'manual_confirmation', ws.manual_appointment_confirmation,
    'public_booking_enabled', ws.public_booking_enabled,
    'business_hours', ws.business_hours,
    'theme_mode', ws.theme_mode,
    'primary_color', ws.primary_color,
    'accent_color', ws.accent_color,
    'background_color', ws.background_color,
    'surface_color', ws.surface_color,
    'text_color', ws.text_color
  )
  from public.workshops w
  join public.workshop_settings ws on ws.workshop_id = w.id
  where w.slug = p_workshop_slug
    and w.active = true;
$$;

revoke all on function public.get_public_workshop_config(text) from public;
grant execute on function public.get_public_workshop_config(text) to anon, authenticated;
