-- HCM Workshop Manager: pruebas técnicas estructuradas por OT.
create table if not exists public.diagnostic_tests (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id() references public.workshops(id),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  symptom text,
  test_name text not null,
  component text,
  expected_value text,
  measured_value text,
  result text not null default 'Pendiente' check (result in ('Correcto','Incorrecto','Pendiente','No aplica')),
  finding text,
  probable_cause text,
  recommendation text,
  client_visible boolean not null default false,
  technician_id uuid default auth.uid() references auth.users(id) on delete set null,
  technician_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagnostic_tests_order_index on public.diagnostic_tests(work_order_id, created_at desc);

create or replace function public.validate_diagnostic_test()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.work_orders where id = new.work_order_id and workshop_id = new.workshop_id) then
    raise exception 'La orden pertenece a otro taller';
  end if;
  new.technician_id := coalesce(new.technician_id, auth.uid());
  if new.technician_name is null then
    select coalesce(display_name, email) into new.technician_name
    from public.workshop_members
    where workshop_id = new.workshop_id and user_id = new.technician_id limit 1;
  end if;
  new.technician_name := coalesce(new.technician_name, 'Técnico HCM');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_diagnostic on public.diagnostic_tests;
create trigger validate_diagnostic before insert or update on public.diagnostic_tests
for each row execute function public.validate_diagnostic_test();

create or replace function public.record_diagnostic_event()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.work_order_events (workshop_id, work_order_id, event_type, title, description, status, client_visible, created_by, actor_name)
  select new.workshop_id, new.work_order_id, 'Diagnóstico', 'Prueba: ' || new.test_name,
    concat_ws(' · ', nullif(new.component,''), 'Resultado: ' || new.result, nullif(new.finding,'')),
    wo.status, new.client_visible, new.technician_id, new.technician_name
  from public.work_orders wo where wo.id = new.work_order_id;
  return new;
end;
$$;

drop trigger if exists record_diagnostic_timeline on public.diagnostic_tests;
create trigger record_diagnostic_timeline after insert on public.diagnostic_tests
for each row execute function public.record_diagnostic_event();

alter table public.diagnostic_tests enable row level security;
drop policy if exists "Miembros leen diagnosticos" on public.diagnostic_tests;
create policy "Miembros leen diagnosticos" on public.diagnostic_tests for select to authenticated
using (public.is_workshop_member(workshop_id));
drop policy if exists "Equipo registra diagnosticos" on public.diagnostic_tests;
create policy "Equipo registra diagnosticos" on public.diagnostic_tests for insert to authenticated
with check (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']));
drop policy if exists "Equipo actualiza diagnosticos" on public.diagnostic_tests;
create policy "Equipo actualiza diagnosticos" on public.diagnostic_tests for update to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','mechanic']));
drop policy if exists "Administracion elimina diagnosticos" on public.diagnostic_tests;
create policy "Administracion elimina diagnosticos" on public.diagnostic_tests for delete to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']));
