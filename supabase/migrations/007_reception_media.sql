-- HCM Workshop Manager
-- Fotografías y firmas privadas de recepción.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'work-order-media',
  'work-order-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.work_order_photos (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id),
  work_order_id uuid not null
    references public.work_orders(id)
    on delete cascade,
  motorcycle_id uuid not null
    references public.motorcycles(id)
    on delete cascade,
  storage_path text not null unique,
  photo_type text not null default 'Otro'
    check (photo_type in (
      'Frente', 'Lado izquierdo', 'Lado derecho',
      'Parte trasera', 'Tablero', 'Daño', 'Otro'
    )),
  caption text,
  client_visible boolean not null default false,
  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.work_order_signatures (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null default public.current_workshop_id()
    references public.workshops(id),
  work_order_id uuid not null
    references public.work_orders(id)
    on delete cascade,
  signer_type text not null
    check (signer_type in ('Cliente', 'Recepcionista')),
  signer_name text,
  storage_path text not null unique,
  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  signed_at timestamptz not null default now(),
  unique (work_order_id, signer_type)
);

create index if not exists work_order_photos_workshop_index
on public.work_order_photos(workshop_id);
create index if not exists work_order_photos_order_index
on public.work_order_photos(work_order_id);
create index if not exists work_order_signatures_workshop_index
on public.work_order_signatures(workshop_id);
create index if not exists work_order_signatures_order_index
on public.work_order_signatures(work_order_id);

create or replace function public.validate_work_order_media_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.work_orders
    where id = new.work_order_id and workshop_id = new.workshop_id
  ) then raise exception 'La OT pertenece a otro taller'; end if;

  if tg_table_name = 'work_order_photos' and not exists (
    select 1 from public.motorcycles
    where id = new.motorcycle_id and workshop_id = new.workshop_id
  ) then raise exception 'La motocicleta pertenece a otro taller'; end if;

  return new;
end;
$$;

drop trigger if exists validate_photo_workshop on public.work_order_photos;
create trigger validate_photo_workshop
before insert or update on public.work_order_photos
for each row execute function public.validate_work_order_media_links();

drop trigger if exists validate_signature_workshop on public.work_order_signatures;
create trigger validate_signature_workshop
before insert or update on public.work_order_signatures
for each row execute function public.validate_work_order_media_links();

alter table public.work_order_photos enable row level security;
alter table public.work_order_signatures enable row level security;

create policy "Miembros leen fotos"
on public.work_order_photos
for select to authenticated
using (public.is_workshop_member(workshop_id));

create policy "Equipo gestiona fotos"
on public.work_order_photos
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception','mechanic']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception','mechanic']));

create policy "Miembros leen firmas"
on public.work_order_signatures
for select to authenticated
using (public.is_workshop_member(workshop_id));

create policy "Recepcion gestiona firmas"
on public.work_order_signatures
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin','reception']))
with check (public.has_workshop_role(workshop_id, array['owner','admin','reception']));

-- El primer segmento del archivo siempre es el workshop_id.
drop policy if exists "Miembros leen archivos de su taller" on storage.objects;
create policy "Miembros leen archivos de su taller"
on storage.objects
for select to authenticated
using (
  case
    when bucket_id = 'work-order-media'
      then public.is_workshop_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

drop policy if exists "Equipo sube archivos de su taller" on storage.objects;
create policy "Equipo sube archivos de su taller"
on storage.objects
for insert to authenticated
with check (
  case
    when bucket_id = 'work-order-media' then public.has_workshop_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','reception','mechanic']
    )
    else false
  end
);

drop policy if exists "Administradores eliminan archivos" on storage.objects;
create policy "Administradores eliminan archivos"
on storage.objects
for delete to authenticated
using (
  case
    when bucket_id = 'work-order-media' then public.has_workshop_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin']
    )
    else false
  end
);
