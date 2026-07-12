-- HCM Workshop Manager: procedimientos de diagnóstico reutilizables.
create table if not exists public.diagnostic_guides (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id() references public.workshops(id) on delete cascade,
  title text not null,
  symptom text not null,
  brand text,
  model text,
  description text,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnostic_guide_steps (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id() references public.workshops(id) on delete cascade,
  guide_id uuid not null references public.diagnostic_guides(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  test_name text not null,
  instruction text not null,
  component text,
  expected_value text,
  safety_note text,
  created_at timestamptz not null default now(),
  unique (guide_id, step_number)
);

alter table public.diagnostic_tests
add column if not exists guide_id uuid references public.diagnostic_guides(id) on delete set null;
alter table public.diagnostic_tests
add column if not exists guide_step_id uuid references public.diagnostic_guide_steps(id) on delete set null;

create index if not exists diagnostic_guides_workshop_index on public.diagnostic_guides(workshop_id, active);
create index if not exists diagnostic_steps_guide_index on public.diagnostic_guide_steps(guide_id, step_number);

create or replace function public.validate_diagnostic_guide_step()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.diagnostic_guides where id = new.guide_id and workshop_id = new.workshop_id) then
    raise exception 'La guía pertenece a otro taller';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_guide_step on public.diagnostic_guide_steps;
create trigger validate_guide_step before insert or update on public.diagnostic_guide_steps
for each row execute function public.validate_diagnostic_guide_step();

alter table public.diagnostic_guides enable row level security;
alter table public.diagnostic_guide_steps enable row level security;

drop policy if exists "Miembros leen guias" on public.diagnostic_guides;
create policy "Miembros leen guias" on public.diagnostic_guides for select to authenticated
using (public.is_workshop_member(workshop_id));
drop policy if exists "Tecnicos gestionan guias" on public.diagnostic_guides;
create policy "Tecnicos gestionan guias" on public.diagnostic_guides for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']));

drop policy if exists "Miembros leen pasos" on public.diagnostic_guide_steps;
create policy "Miembros leen pasos" on public.diagnostic_guide_steps for select to authenticated
using (public.is_workshop_member(workshop_id));
drop policy if exists "Tecnicos gestionan pasos" on public.diagnostic_guide_steps;
create policy "Tecnicos gestionan pasos" on public.diagnostic_guide_steps for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']));

create or replace function public.create_diagnostic_guide(
  p_title text, p_symptom text, p_brand text, p_model text,
  p_description text, p_steps jsonb
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target_workshop uuid; guide_id uuid; step jsonb; step_position integer := 0;
begin
  target_workshop := public.current_workshop_id();
  if not public.has_workshop_role(target_workshop, array['owner','admin','mechanic']) then
    raise exception 'No tienes permiso para crear guías';
  end if;
  if trim(coalesce(p_title,'')) = '' or trim(coalesce(p_symptom,'')) = '' then
    raise exception 'El nombre y el síntoma son obligatorios';
  end if;
  if jsonb_array_length(coalesce(p_steps, '[]'::jsonb)) = 0 then
    raise exception 'La guía necesita al menos un paso';
  end if;
  insert into public.diagnostic_guides (workshop_id, title, symptom, brand, model, description)
  values (target_workshop, trim(p_title), trim(p_symptom), nullif(trim(coalesce(p_brand,'')),''),
    nullif(trim(coalesce(p_model,'')),''), nullif(trim(coalesce(p_description,'')),''))
  returning id into guide_id;
  for step in select * from jsonb_array_elements(p_steps) loop
    step_position := step_position + 1;
    insert into public.diagnostic_guide_steps (workshop_id, guide_id, step_number, test_name, instruction, component, expected_value, safety_note)
    values (target_workshop, guide_id, step_position, step->>'test_name', step->>'instruction',
      nullif(step->>'component',''), nullif(step->>'expected_value',''), nullif(step->>'safety_note',''));
  end loop;
  return guide_id;
end;
$$;
revoke all on function public.create_diagnostic_guide(text,text,text,text,text,jsonb) from public;
grant execute on function public.create_diagnostic_guide(text,text,text,text,text,jsonb) to authenticated;
