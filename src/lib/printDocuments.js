const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const dateTime = value => value
  ? new Intl.DateTimeFormat('es-CR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
  : 'No registrado'

const value = item => escapeHtml(item || 'No registrado')

function openPrintDocument(title, body) {
  const popup = window.open('', '_blank')
  if (!popup) {
    alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para HCM.')
    return
  }

  popup.document.write(`<!doctype html>
  <html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #171717; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.38; }
    header { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: start; padding-bottom: 14px; border-bottom: 3px solid #e0a814; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .logo { width: 52px; height: 52px; display: grid; place-items: center; background: #e0a814; border-radius: 10px; font-weight: 900; font-size: 15pt; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 3px; font-size: 18pt; }
    h2 { margin: 20px 0 9px; padding-bottom: 5px; border-bottom: 1px solid #bbb; font-size: 12pt; }
    .document-number { text-align: right; }
    .document-number strong { display: block; font-size: 15pt; }
    .muted, small { color: #606060; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .fact { min-height: 54px; padding: 9px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; }
    .fact span { display: block; color: #666; font-size: 8.5pt; text-transform: uppercase; }
    .fact strong { display: block; margin-top: 3px; }
    .notes { white-space: pre-wrap; padding: 10px; border: 1px solid #ccc; border-radius: 6px; min-height: 48px; }
    ul { margin: 6px 0; padding-left: 20px; columns: 2; }
    li { break-inside: avoid; margin-bottom: 4px; }
    .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    figure { margin: 0; break-inside: avoid; }
    figure img { display: block; width: 100%; height: 175px; object-fit: cover; border: 1px solid #aaa; border-radius: 5px; }
    figcaption { padding: 4px 0; color: #555; font-size: 8.5pt; }
    .signature { width: 100%; max-width: 330px; margin-top: 8px; text-align: center; break-inside: avoid; }
    .signature img { width: 100%; height: 115px; object-fit: contain; border-bottom: 1px solid #333; }
    .signature span { display: block; margin-top: 5px; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .items-table th, .items-table td { padding: 8px 6px; border-bottom: 1px solid #ccc; text-align: left; vertical-align: top; }
    .items-table th { background: #f2f2f2; color: #555; font-size: 8.5pt; text-transform: uppercase; }
    .items-table .number { text-align: right; white-space: nowrap; }
    .totals { width: min(330px, 100%); margin: 14px 0 0 auto; display: grid; gap: 5px; }
    .totals div { display: flex; justify-content: space-between; gap: 20px; padding: 4px 0; }
    .totals .grand { margin-top: 4px; padding-top: 8px; border-top: 2px solid #333; font-size: 12pt; }
    .document-status { display: inline-block; margin-top: 5px; padding: 4px 8px; border: 1px solid #999; border-radius: 999px; font-size: 8.5pt; font-weight: 700; }
    .disclaimer { margin-top: 14px; padding: 9px; background: #f5f5f5; border-left: 4px solid #555; font-size: 8.5pt; }
    footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #bbb; color: #666; font-size: 8.5pt; text-align: center; }
    .screen-actions { position: fixed; right: 18px; top: 18px; display: flex; gap: 8px; }
    .screen-actions button { border: 0; border-radius: 8px; padding: 10px 14px; cursor: pointer; font-weight: 700; }
    .print { background: #e0a814; }
    @media print { .screen-actions { display: none; } }
    @media (max-width: 620px) { .grid, .photos { grid-template-columns: 1fr; } header { grid-template-columns: 1fr; } .document-number { text-align: left; } }
  </style></head><body>
  <div class="screen-actions"><button onclick="window.print()" class="print">Imprimir / Guardar PDF</button><button onclick="window.close()">Cerrar</button></div>
  ${body}</body></html>`)
  popup.document.close()
}

const money = value => new Intl.NumberFormat('es-CR', {
  style: 'currency', currency: 'CRC', maximumFractionDigits: 0
}).format(Number(value || 0))

const shortDate = item => item
  ? new Intl.DateTimeFormat('es-CR', { dateStyle: 'long' }).format(new Date(`${String(item).slice(0, 10)}T12:00:00`))
  : 'No registrada'

function brandedHeader({ title, number, date, workshop, branding }) {
  const workshopName = workshop?.name || 'Herrera Custom Motorcycle'
  const printColor = branding?.primary_color || '#222222'
  const logoMarkup = branding?.logo_url
    ? `<img src="${escapeHtml(branding.logo_url)}" alt="Logo" style="width:52px;height:52px;object-fit:contain">`
    : 'HCM'
  const contact = [branding?.phone, branding?.email, branding?.address].filter(Boolean).map(escapeHtml).join(' · ')
  return `
    <style>.logo{background:${escapeHtml(printColor)};color:#fff} header{border-bottom-color:${escapeHtml(printColor)}} .print{background:${escapeHtml(printColor)};color:#fff}</style>
    <header><div class="brand"><div class="logo">${logoMarkup}</div><div><h1>${escapeHtml(workshopName)}</h1><span class="muted">${escapeHtml(title)}</span>${contact ? `<br><small>${contact}</small>` : ''}</div></div><div class="document-number"><small>${escapeHtml(title.toUpperCase())}</small><strong>${value(number)}</strong><span>${escapeHtml(date)}</span></div></header>`
}

export function printReceptionDocument({ order, photos = [], signatures = [], workshop = null, branding = null }) {
  const workshopName = workshop?.name || 'Herrera Custom Motorcycle'
  const printColor = branding?.primary_color || '#222222'
  const logoMarkup = branding?.logo_url
    ? `<img src="${escapeHtml(branding.logo_url)}" alt="Logo" style="width:52px;height:52px;object-fit:contain">`
    : 'HCM'
  const receptionSignature = signatures.find(item =>
    item.signer_type === 'Cliente' && (!item.signature_stage || item.signature_stage === 'Recepción')
  )
  const inspection = order.accessories || []
  const photoMarkup = photos.length
    ? photos.map(photo => `<figure><img src="${escapeHtml(photo.signedUrl)}" alt="${escapeHtml(photo.photo_type)}"><figcaption>${value(photo.photo_type)}${photo.caption ? ` - ${value(photo.caption)}` : ''}</figcaption></figure>`).join('')
    : '<p class="muted">Sin fotografías registradas.</p>'

  openPrintDocument(`Recepción ${order.order_number}`, `
    <style>.logo{background:${escapeHtml(printColor)};color:#fff} header{border-bottom-color:${escapeHtml(printColor)}} .print{background:${escapeHtml(printColor)};color:#fff}</style>
    <header>
      <div class="brand"><div class="logo">${logoMarkup}</div><div><h1>${escapeHtml(workshopName)}</h1><span class="muted">Recepción de motocicleta</span></div></div>
      <div class="document-number"><small>ORDEN DE TRABAJO</small><strong>${value(order.order_number)}</strong><span>${dateTime(order.received_at)}</span></div>
    </header>

    <h2>Cliente y motocicleta</h2>
    <div class="grid">
      <div class="fact"><span>Cliente</span><strong>${value(order.customer?.full_name)}</strong><small>${value(order.customer?.phone)}</small></div>
      <div class="fact"><span>Motocicleta</span><strong>${value(`${order.motorcycle?.brand || ''} ${order.motorcycle?.model || ''}`.trim())}</strong><small>Placa: ${value(order.motorcycle?.plate || 'Sin placa')}</small></div>
      <div class="fact"><span>Kilometraje de ingreso</span><strong>${order.mileage?.toLocaleString('es-CR') || 'No registrado'} km</strong></div>
      <div class="fact"><span>Combustible</span><strong>${value(order.fuel_level)}</strong></div>
    </div>

    <h2>Motivo del ingreso</h2><div class="notes">${value(order.intake_notes)}</div>
    <h2>Inspección de ingreso</h2>
    <div class="grid"><div class="fact"><span>Llave principal</span><strong>${order.main_key ? 'Entregada' : 'No entregada'}</strong></div><div class="fact"><span>Llave de repuesto</span><strong>${order.spare_key ? 'Entregada' : 'No entregada'}</strong></div></div>
    ${inspection.length ? `<ul>${inspection.map(item => `<li>${value(item)}</li>`).join('')}</ul>` : '<p class="muted">Sin inspección técnica registrada.</p>'}
    ${order.internal_notes ? `<h2>Observaciones del taller</h2><div class="notes">${value(order.internal_notes)}</div>` : ''}

    <h2>Fotografías de recepción</h2><div class="photos">${photoMarkup}</div>
    <h2>Conformidad de recepción</h2>
    ${receptionSignature?.signedUrl ? `<div class="signature"><img src="${escapeHtml(receptionSignature.signedUrl)}" alt="Firma del cliente"><span>${value(receptionSignature.signer_name || order.customer?.full_name)}</span><small>Firma del cliente</small></div>` : '<p class="muted">Sin firma registrada.</p>'}
    <footer>Documento generado por HCM Workshop Manager - ${escapeHtml(workshopName)}</footer>
  `)
}

export function printQuoteDocument({ quote, workshop = null, branding = null }) {
  const rows = (quote.items || []).map(item => `
    <tr><td>${value(item.item_type)}</td><td>${value(item.description)}</td><td class="number">${escapeHtml(item.quantity)}</td><td class="number">${escapeHtml(money(item.unit_price))}</td><td class="number"><strong>${escapeHtml(money(item.line_total))}</strong></td></tr>
  `).join('')
  openPrintDocument(`Presupuesto ${quote.quote_number}`, `
    ${brandedHeader({ title: 'Presupuesto', number: quote.quote_number, date: `Emitido: ${shortDate(quote.created_at)}`, workshop, branding })}
    <span class="document-status">${value(quote.status)}</span>
    <h2>Cliente y motocicleta</h2>
    <div class="grid"><div class="fact"><span>Cliente</span><strong>${value(quote.work_order?.customer?.full_name)}</strong><small>${value(quote.work_order?.customer?.phone)}</small></div><div class="fact"><span>Motocicleta</span><strong>${value(`${quote.work_order?.motorcycle?.brand || ''} ${quote.work_order?.motorcycle?.model || ''}`.trim())}</strong><small>Placa: ${value(quote.work_order?.motorcycle?.plate || 'Sin placa')} · OT: ${value(quote.work_order?.order_number)}</small></div></div>
    <h2>Detalle del presupuesto</h2>
    <table class="items-table"><thead><tr><th>Tipo</th><th>Descripción</th><th class="number">Cant.</th><th class="number">Precio</th><th class="number">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div><span>Subtotal</span><strong>${escapeHtml(money(quote.subtotal))}</strong></div><div><span>Descuento</span><strong>- ${escapeHtml(money(quote.discount))}</strong></div><div><span>IVA (${escapeHtml(quote.tax_rate)}%)</span><strong>${escapeHtml(money(quote.tax_amount))}</strong></div><div class="grand"><span>Total</span><strong>${escapeHtml(money(quote.total))}</strong></div></div>
    ${quote.notes ? `<h2>Notas</h2><div class="notes">${value(quote.notes)}</div>` : ''}
    <div class="disclaimer">Presupuesto válido hasta ${shortDate(quote.valid_until)}. Cualquier trabajo adicional deberá ser autorizado por el cliente.</div>
    <footer>Documento generado por HCM Workshop Manager - ${escapeHtml(workshop?.name || 'Herrera Custom Motorcycle')}</footer>
  `)
}

export function printInvoiceDocument({ invoice, workshop = null, branding = null }) {
  const rows = (invoice.items || []).map(item => `
    <tr><td>${value(item.item_type)}</td><td>${value(item.description)}</td><td class="number">${escapeHtml(item.quantity)}</td><td class="number">${escapeHtml(money(item.unit_price))}</td><td class="number"><strong>${escapeHtml(money(item.line_total))}</strong></td></tr>
  `).join('')
  const payments = (invoice.payments || []).length
    ? `<h2>Pagos registrados</h2><table class="items-table"><thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th class="number">Monto</th></tr></thead><tbody>${[...invoice.payments].sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at)).map(item => `<tr><td>${escapeHtml(dateTime(item.paid_at))}</td><td>${value(item.payment_method)}</td><td>${value(item.reference || item.notes || 'Sin referencia')}</td><td class="number">${escapeHtml(money(item.amount))}</td></tr>`).join('')}</tbody></table>`
    : ''
  const balance = Number(invoice.total) - Number(invoice.amount_paid)
  openPrintDocument(`Factura interna ${invoice.invoice_number}`, `
    ${brandedHeader({ title: 'Comprobante interno de servicio', number: invoice.invoice_number, date: `Emitido: ${shortDate(invoice.issued_at)}`, workshop, branding })}
    <span class="document-status">${value(invoice.status)}</span>
    <h2>Cliente y motocicleta</h2>
    <div class="grid"><div class="fact"><span>Cliente</span><strong>${value(invoice.work_order?.customer?.full_name)}</strong><small>${value(invoice.work_order?.customer?.phone)} · ${value(invoice.work_order?.customer?.email)}</small></div><div class="fact"><span>Motocicleta</span><strong>${value(`${invoice.work_order?.motorcycle?.brand || ''} ${invoice.work_order?.motorcycle?.model || ''}`.trim())}</strong><small>Placa: ${value(invoice.work_order?.motorcycle?.plate || 'Sin placa')} · OT: ${value(invoice.work_order?.order_number)}</small></div></div>
    <h2>Detalle</h2><table class="items-table"><thead><tr><th>Tipo</th><th>Descripción</th><th class="number">Cant.</th><th class="number">Precio</th><th class="number">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div><span>Subtotal</span><strong>${escapeHtml(money(invoice.subtotal))}</strong></div><div><span>Descuento</span><strong>- ${escapeHtml(money(invoice.discount))}</strong></div><div><span>IVA (${escapeHtml(invoice.tax_rate)}%)</span><strong>${escapeHtml(money(invoice.tax_amount))}</strong></div><div><span>Pagado</span><strong>${escapeHtml(money(invoice.amount_paid))}</strong></div><div class="grand"><span>Saldo</span><strong>${escapeHtml(money(balance))}</strong></div></div>
    ${payments}
    ${invoice.notes ? `<h2>Notas</h2><div class="notes">${value(invoice.notes)}</div>` : ''}
    <div class="disclaimer"><strong>Comprobante interno:</strong> este documento sirve para el control del taller y no sustituye el comprobante electrónico autorizado por el Ministerio de Hacienda.</div>
    <footer>Documento generado por HCM Workshop Manager - ${escapeHtml(workshop?.name || 'Herrera Custom Motorcycle')}</footer>
  `)
}
