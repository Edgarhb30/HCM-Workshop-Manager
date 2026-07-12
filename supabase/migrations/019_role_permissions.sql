-- HCM Workshop Manager
-- Permisos operativos por rol. Mantiene lectura para miembros activos y
-- limita las acciones destructivas a propietario/administrador.

-- Órdenes: recepción y mecánicos trabajan; solo administración elimina.
drop policy if exists "Equipo gestiona ordenes" on public.work_orders;
drop policy if exists "Equipo crea ordenes" on public.work_orders;
drop policy if exists "Equipo actualiza ordenes" on public.work_orders;
drop policy if exists "Administracion elimina ordenes" on public.work_orders;
create policy "Equipo crea ordenes" on public.work_orders
for insert to authenticated
with check (public.has_workshop_role(
  workshop_id, array['owner','admin','reception','mechanic']
));
create policy "Equipo actualiza ordenes" on public.work_orders
for update to authenticated
using (public.has_workshop_role(
  workshop_id, array['owner','admin','reception','mechanic']
))
with check (public.has_workshop_role(
  workshop_id, array['owner','admin','reception','mechanic']
));
create policy "Administracion elimina ordenes" on public.work_orders
for delete to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']));

-- Aceite: técnicos registran y corrigen; administración elimina.
drop policy if exists "Tecnicos gestionan aceite" on public.oil_changes;
drop policy if exists "Tecnicos registran aceite" on public.oil_changes;
drop policy if exists "Tecnicos actualizan aceite" on public.oil_changes;
drop policy if exists "Administracion elimina aceite" on public.oil_changes;
create policy "Tecnicos registran aceite" on public.oil_changes
for insert to authenticated
with check (public.has_workshop_role(
  workshop_id, array['owner','admin','mechanic']
));
create policy "Tecnicos actualizan aceite" on public.oil_changes
for update to authenticated
using (public.has_workshop_role(
  workshop_id, array['owner','admin','mechanic']
))
with check (public.has_workshop_role(
  workshop_id, array['owner','admin','mechanic']
));
create policy "Administracion elimina aceite" on public.oil_changes
for delete to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']));

-- Catálogo de inventario: el mecánico consulta y registra movimientos,
-- pero solo administración cambia o elimina productos.
drop policy if exists "Tecnicos gestionan productos" on public.inventory_products;
drop policy if exists "Administracion gestiona productos" on public.inventory_products;
create policy "Administracion gestiona productos" on public.inventory_products
for all to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']))
with check (public.has_workshop_role(workshop_id, array['owner','admin']));

drop policy if exists "Tecnicos gestionan movimientos" on public.inventory_movements;
drop policy if exists "Equipo registra movimientos" on public.inventory_movements;
drop policy if exists "Administracion corrige movimientos" on public.inventory_movements;
drop policy if exists "Administracion elimina movimientos" on public.inventory_movements;
create policy "Equipo registra movimientos" on public.inventory_movements
for insert to authenticated
with check (public.has_workshop_role(
  workshop_id, array['owner','admin','mechanic']
));
create policy "Administracion corrige movimientos" on public.inventory_movements
for update to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']))
with check (public.has_workshop_role(workshop_id, array['owner','admin']));
create policy "Administracion elimina movimientos" on public.inventory_movements
for delete to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']));

-- Presupuestos: recepción los prepara; administración puede eliminarlos.
drop policy if exists "Administracion gestiona presupuestos" on public.quotes;
drop policy if exists "Recepcion crea presupuestos" on public.quotes;
drop policy if exists "Recepcion actualiza presupuestos" on public.quotes;
drop policy if exists "Administracion elimina presupuestos" on public.quotes;
create policy "Recepcion crea presupuestos" on public.quotes
for insert to authenticated
with check (public.has_workshop_role(
  workshop_id, array['owner','admin','reception']
));
create policy "Recepcion actualiza presupuestos" on public.quotes
for update to authenticated
using (public.has_workshop_role(
  workshop_id, array['owner','admin','reception']
))
with check (public.has_workshop_role(
  workshop_id, array['owner','admin','reception']
));
create policy "Administracion elimina presupuestos" on public.quotes
for delete to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']));

drop policy if exists "Administracion gestiona lineas" on public.quote_items;
drop policy if exists "Recepcion crea lineas" on public.quote_items;
drop policy if exists "Recepcion actualiza lineas" on public.quote_items;
drop policy if exists "Administracion elimina lineas" on public.quote_items;
create policy "Recepcion crea lineas" on public.quote_items
for insert to authenticated
with check (public.has_workshop_role(
  workshop_id, array['owner','admin','reception']
));
create policy "Recepcion actualiza lineas" on public.quote_items
for update to authenticated
using (public.has_workshop_role(
  workshop_id, array['owner','admin','reception']
))
with check (public.has_workshop_role(
  workshop_id, array['owner','admin','reception']
));
create policy "Administracion elimina lineas" on public.quote_items
for delete to authenticated
using (public.has_workshop_role(workshop_id, array['owner','admin']));
