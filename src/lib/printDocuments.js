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
