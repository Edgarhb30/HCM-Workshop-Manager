-- HCM Workshop Manager
-- Detalle seguro de presupuestos y facturas para Mi moto.

create or replace function public.get_client_document(
  p_workshop_slug text,
  p_document_type text,
  p_document_number text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  access_record public.customer_portal_access%rowtype;
  result jsonb;
begin
  select cpa.* into access_record
  from public.customer_portal_access cpa
  join public.workshops w on w.id = cpa.workshop_id
  where cpa.user_id = auth.uid()
    and cpa.active = true
    and w.slug = p_workshop_slug
    and w.active = true;

  if not found then
    raise exception 'No tienes acceso al expediente de este taller';
  end if;

  if p_document_type = 'quote' then
    select jsonb_build_object(
      'type', 'quote',
      'document', jsonb_build_object(
        'id', q.id,
        'quote_number', q.quote_number,
        'status', q.status,
        'subtotal', q.subtotal,
        'discount', q.discount,
        'tax_rate', q.tax_rate,
        'tax_amount', q.tax_amount,
        'total', q.total,
        'notes', q.notes,
        'valid_until', q.valid_until,
        'created_at', q.created_at,
        'work_order', jsonb_build_object(
          'order_number', wo.order_number,
          'customer', jsonb_build_object(
            'full_name', c.full_name,
            'phone', c.phone,
            'email', c.email
          ),
          'motorcycle', jsonb_build_object(
            'brand', m.brand,
            'model', m.model,
            'plate', m.plate
          )
        ),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', qi.id,
            'item_type', qi.item_type,
            'description', qi.description,
            'quantity', qi.quantity,
            'unit_price', qi.unit_price,
            'line_total', qi.line_total
          ) order by qi.created_at)
          from public.quote_items qi
          where qi.quote_id = q.id
        ), '[]'::jsonb)
      )
    ) into result
    from public.quotes q
    join public.work_orders wo on wo.id = q.work_order_id
    join public.customers c on c.id = wo.customer_id
    join public.motorcycles m on m.id = wo.motorcycle_id
    where q.workshop_id = access_record.workshop_id
      and wo.customer_id = access_record.customer_id
      and q.quote_number = p_document_number
      and q.status in ('Enviado', 'Aprobado', 'Rechazado');

  elsif p_document_type = 'invoice' then
    select jsonb_build_object(
      'type', 'invoice',
      'document', jsonb_build_object(
        'id', i.id,
        'invoice_number', i.invoice_number,
        'status', i.status,
        'subtotal', i.subtotal,
        'discount', i.discount,
        'tax_rate', i.tax_rate,
        'tax_amount', i.tax_amount,
        'total', i.total,
        'amount_paid', i.amount_paid,
        'notes', i.notes,
        'issued_at', i.issued_at,
        'work_order', jsonb_build_object(
          'order_number', wo.order_number,
          'customer', jsonb_build_object(
            'full_name', c.full_name,
            'phone', c.phone,
            'email', c.email
          ),
          'motorcycle', jsonb_build_object(
            'brand', m.brand,
            'model', m.model,
            'plate', m.plate
          )
        ),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', ii.id,
            'item_type', ii.item_type,
            'description', ii.description,
            'quantity', ii.quantity,
            'unit_price', ii.unit_price,
            'line_total', ii.line_total
          ) order by ii.created_at)
          from public.invoice_items ii
          where ii.invoice_id = i.id
        ), '[]'::jsonb),
        'payments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', ip.id,
            'amount', ip.amount,
            'payment_method', ip.payment_method,
            'reference', ip.reference,
            'notes', ip.notes,
            'paid_at', ip.paid_at
          ) order by ip.paid_at)
          from public.invoice_payments ip
          where ip.invoice_id = i.id
        ), '[]'::jsonb)
      )
    ) into result
    from public.invoices i
    join public.work_orders wo on wo.id = i.work_order_id
    join public.customers c on c.id = wo.customer_id
    join public.motorcycles m on m.id = wo.motorcycle_id
    where i.workshop_id = access_record.workshop_id
      and wo.customer_id = access_record.customer_id
      and i.invoice_number = p_document_number
      and i.status <> 'Anulada';
  else
    raise exception 'Tipo de documento no permitido';
  end if;

  if result is null then
    raise exception 'Documento no encontrado o sin autorización';
  end if;

  return result;
end;
$$;

revoke all on function public.get_client_document(text, text, text) from public;
grant execute on function public.get_client_document(text, text, text) to authenticated;
