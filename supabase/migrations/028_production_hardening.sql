-- HCM Workshop Manager 1.0
-- Cierre de seguridad para producción.
-- Las reservas públicas continúan funcionando únicamente mediante RPC validadas.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'appointments', 'customers', 'motorcycles', 'work_orders', 'oil_changes',
    'quotes', 'quote_items', 'inventory_products', 'inventory_movements',
    'workshops', 'workshop_members', 'invoices', 'invoice_items',
    'invoice_payments', 'workshop_settings', 'work_order_photos',
    'work_order_signatures', 'customer_portal_access', 'work_order_deliveries',
    'maintenance_records', 'work_order_events', 'workshop_invitations',
    'work_order_assignments', 'notifications', 'diagnostic_tests',
    'diagnostic_guides', 'diagnostic_guide_steps', 'appointment_services',
    'schedule_blocks'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from anon', table_name);
    end if;
  end loop;
end;
$$;

-- Las funciones públicas modernas trabajan por slug y validan sus entradas.
-- La función heredada ya no debe revelar el taller predeterminado a visitantes.
revoke execute on function public.current_workshop_id() from anon;

-- Confirmar solamente las RPC necesarias para el portal público.
grant execute on function public.get_public_workshop_config(text) to anon;
grant execute on function public.get_public_booking_config(text) to anon;
grant execute on function public.get_public_available_slots(text, date, uuid) to anon;
grant execute on function public.create_public_appointment_v2(
  text, text, text, text, text, text, integer, text, uuid, date, time, text
) to anon;

-- Retirar RPC heredadas que ya no utiliza la aplicación.
revoke execute on function public.get_booked_slots(date) from anon;
revoke execute on function public.get_public_booked_slots(text, date) from anon;
revoke execute on function public.create_public_appointment(
  text, text, text, text, text, text, integer, text, text, date, time, text
) from anon;
