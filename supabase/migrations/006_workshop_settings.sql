-- HCM Workshop Manager
-- Configuración operativa aislada por taller.

create table if not exists public.workshop_settings (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null unique default public.current_workshop_id()
    references public.workshops(id)
    on delete cascade,
  legal_name text,
  tax_id text,
  phone text,
  whatsapp text,
  email text,
  address text,
  logo_url text,
  default_tax_rate numeric(5,2) not null default 13
    check (default_tax_rate >= 0),
  appointment_slot_minutes integer not null default 60
    check (appointment_slot_minutes between 15 and 480),
  manual_appointment_confirmation boolean not null default true,
  public_booking_enabled boolean not null default true,
  oil_change_interval_km integer not null default 3000
    check (oil_change_interval_km > 0),
  business_hours jsonb not null default '{
    "monday": {"open": true, "start": "08:00", "end": "17:00"},
    "tuesday": {"open": true, "start": "08:00", "end": "17:00"},
    "wednesday": {"open": true, "start": "08:00", "end": "17:00"},
    "thursday": {"open": true, "start": "08:00", "end": "17:00"},
    "friday": {"open": true, "start": "08:00", "end": "17:00"},
    "saturday": {"open": true, "start": "08:00", "end": "13:00"},
    "sunday": {"open": false, "start": "08:00", "end": "17:00"}
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.workshop_settings (
  workshop_id,
  legal_name,
  phone,
  whatsapp,
  email,
  default_tax_rate
)
select
  id,
  'Herrera Custom Motorcycle',
  null,
  null,
  'edgarhb30@gmail.com',
  13
from public.workshops
where slug = 'herrera-custom-motorcycle'
on conflict (workshop_id) do nothing;

alter table public.workshop_settings enable row level security;

create policy "Miembros leen configuracion"
on public.workshop_settings
for select
to authenticated
using (public.is_workshop_member(workshop_id));

create policy "Administradores actualizan configuracion"
on public.workshop_settings
for update
to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']))
with check (public.has_workshop_role(workshop_id, array['owner','admin']));

create policy "Administradores crean configuracion"
on public.workshop_settings
for insert
to authenticated
with check (public.has_workshop_role(workshop_id, array['owner','admin']));
