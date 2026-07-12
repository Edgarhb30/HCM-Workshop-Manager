-- Corrige la validación de firmas: las firmas no tienen motorcycle_id.

create or replace function public.validate_work_order_media_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'work_order_photos' then
    if not exists (
      select 1 from public.work_orders
      where id = new.work_order_id
        and workshop_id = new.workshop_id
    ) then
      raise exception 'La OT pertenece a otro taller';
    end if;

    if not exists (
      select 1 from public.motorcycles
      where id = new.motorcycle_id
        and workshop_id = new.workshop_id
    ) then
      raise exception 'La motocicleta pertenece a otro taller';
    end if;

  elsif tg_table_name = 'work_order_signatures' then
    if not exists (
      select 1 from public.work_orders
      where id = new.work_order_id
        and workshop_id = new.workshop_id
    ) then
      raise exception 'La OT pertenece a otro taller';
    end if;
  end if;

  return new;
end;
$$;
