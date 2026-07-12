-- HCM Workshop Manager: identifica quién realizó cada evento de una OT.
alter table public.work_order_events
add column if not exists actor_name text;

update public.work_order_events event
set actor_name = coalesce(member.display_name, member.email)
from public.workshop_members member
where event.created_by = member.user_id
  and event.workshop_id = member.workshop_id
  and event.actor_name is null;

create or replace function public.set_work_order_event_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  if new.actor_name is null then
    select coalesce(display_name, email)
    into new.actor_name
    from public.workshop_members
    where workshop_id = new.workshop_id
      and user_id = new.created_by
    limit 1;
  end if;
  new.actor_name := coalesce(new.actor_name, 'Sistema HCM');
  return new;
end;
$$;

drop trigger if exists set_event_actor on public.work_order_events;
create trigger set_event_actor
before insert or update on public.work_order_events
for each row execute function public.set_work_order_event_actor();

