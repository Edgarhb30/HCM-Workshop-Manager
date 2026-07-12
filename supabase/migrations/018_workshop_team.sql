-- HCM Workshop Manager
-- Invitaciones seguras y gestión de roles del equipo por taller.

alter table public.workshop_members
add column if not exists email text;

alter table public.workshop_members
add column if not exists display_name text;

update public.workshop_members wm
set email = lower(u.email)
from auth.users u
where wm.user_id = u.id
  and wm.email is null;

create table if not exists public.workshop_invitations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null
    references public.workshops(id)
    on delete cascade,
  email text not null,
  display_name text,
  role text not null
    check (role in ('admin', 'reception', 'mechanic', 'viewer')),
  status text not null default 'Pendiente'
    check (status in ('Pendiente', 'Aceptada', 'Revocada', 'Vencida')),
  invited_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_id, email)
);

create index if not exists workshop_invitations_workshop_index
on public.workshop_invitations(workshop_id, status);

create or replace function public.invite_workshop_member(
  p_workshop_id uuid,
  p_email text,
  p_display_name text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
  requester_role text;
begin
  select role into requester_role
  from public.workshop_members
  where workshop_id = p_workshop_id
    and user_id = auth.uid()
    and active = true;

  if requester_role not in ('owner', 'admin') then
    raise exception 'No tienes permiso para invitar miembros';
  end if;

  if p_role not in ('admin', 'reception', 'mechanic', 'viewer') then
    raise exception 'Rol no permitido';
  end if;

  if requester_role = 'admin' and p_role = 'admin' then
    raise exception 'Solo el propietario puede invitar administradores';
  end if;

  if trim(coalesce(p_email, '')) = '' then
    raise exception 'El correo es obligatorio';
  end if;

  insert into public.workshop_invitations (
    workshop_id, email, display_name, role, status,
    invited_by, expires_at, accepted_at, updated_at
  ) values (
    p_workshop_id,
    lower(trim(p_email)),
    nullif(trim(coalesce(p_display_name, '')), ''),
    p_role,
    'Pendiente',
    auth.uid(),
    now() + interval '7 days',
    null,
    now()
  )
  on conflict (workshop_id, email) do update
  set
    display_name = excluded.display_name,
    role = excluded.role,
    status = 'Pendiente',
    invited_by = auth.uid(),
    expires_at = now() + interval '7 days',
    accepted_at = null,
    updated_at = now()
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create or replace function public.accept_my_workshop_invitation()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.workshop_invitations%rowtype;
  authenticated_email text;
begin
  if auth.uid() is null then return false; end if;

  authenticated_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if authenticated_email = '' then return false; end if;

  select * into invitation
  from public.workshop_invitations
  where email = authenticated_email
    and status = 'Pendiente'
    and expires_at > now()
  order by created_at
  limit 1
  for update;

  if not found then return false; end if;

  insert into public.workshop_members (
    workshop_id, user_id, role, active, email, display_name
  ) values (
    invitation.workshop_id,
    auth.uid(),
    invitation.role,
    true,
    authenticated_email,
    invitation.display_name
  )
  on conflict (workshop_id, user_id) do update
  set
    role = excluded.role,
    active = true,
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.workshop_members.display_name);

  update public.workshop_invitations
  set status = 'Aceptada', accepted_at = now(), updated_at = now()
  where id = invitation.id;

  return true;
end;
$$;

create or replace function public.update_workshop_member_role(
  p_member_id uuid,
  p_role text,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.workshop_members%rowtype;
  requester_role text;
begin
  select * into target from public.workshop_members where id = p_member_id;
  if not found then raise exception 'Miembro no encontrado'; end if;

  select role into requester_role
  from public.workshop_members
  where workshop_id = target.workshop_id
    and user_id = auth.uid()
    and active = true;

  if requester_role not in ('owner', 'admin') then
    raise exception 'No tienes permiso para modificar el equipo';
  end if;
  if target.role = 'owner' then raise exception 'El propietario no puede ser desactivado'; end if;
  if p_role not in ('admin', 'reception', 'mechanic', 'viewer') then raise exception 'Rol no permitido'; end if;
  if requester_role = 'admin' and (target.role = 'admin' or p_role = 'admin') then
    raise exception 'Solo el propietario puede administrar otros administradores';
  end if;

  update public.workshop_members
  set role = p_role, active = p_active
  where id = p_member_id;
  return true;
end;
$$;

alter table public.workshop_invitations enable row level security;

create policy "Administracion lee invitaciones"
on public.workshop_invitations
for select to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']));

create policy "Administracion revoca invitaciones"
on public.workshop_invitations
for update to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']))
with check (public.has_workshop_role(workshop_id, array['owner','admin']));

revoke all on function public.invite_workshop_member(uuid, text, text, text) from public;
grant execute on function public.invite_workshop_member(uuid, text, text, text) to authenticated;
revoke all on function public.accept_my_workshop_invitation() from public;
grant execute on function public.accept_my_workshop_invitation() to authenticated;
revoke all on function public.update_workshop_member_role(uuid, text, boolean) from public;
grant execute on function public.update_workshop_member_role(uuid, text, boolean) to authenticated;
