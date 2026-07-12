import { useEffect, useMemo, useState } from 'react'
import {
  Bike,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  History,
  MessageCircle,
  Printer,
  Save,
  Search,
  UserRound,
  Wrench,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import SignaturePad from '../components/SignaturePad'
import { printDeliveryDocument, printReceptionDocument } from '../lib/printDocuments'

const statuses = ['Recepción', 'Diagnóstico', 'Esperando aprobación', 'Esperando repuestos', 'En reparación', 'Prueba', 'Lista para entregar', 'Entregada', 'Cancelada']
const editableStatuses = statuses.filter(item => item !== 'Entregada')

const emptyDelivery = {
  receiver_name: '', receiver_identification: '', mileage_out: '',
  fuel_level_out: '1/2', work_summary: '', recommendations: '',
  returned_items: '', payment_condition: 'Sin factura',
  customer_conformity: true, delivery_notes: ''
}

const statusClass = status =>
  status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '-')

const formatDate = value => value
  ? new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—'

export default function WorkOrders({ workshop = null, branding = null, role }) {
  const canEdit = ['owner', 'admin', 'reception', 'mechanic'].includes(role)
  const canDeliver = ['owner', 'admin', 'reception'].includes(role)
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Todas')
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingNotes, setSavingNotes] = useState(false)
  const [orderPhotos, setOrderPhotos] = useState([])
  const [orderSignatures, setOrderSignatures] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [delivery, setDelivery] = useState(null)
  const [deliveryForm, setDeliveryForm] = useState(emptyDelivery)
  const [deliverySignature, setDeliverySignature] = useState('')
  const [showDelivery, setShowDelivery] = useState(false)
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [invoiceBalance, setInvoiceBalance] = useState(null)
  const [orderEvents, setOrderEvents] = useState([])
  const [eventForm, setEventForm] = useState({ title: '', description: '', client_visible: false })
  const [savingEvent, setSavingEvent] = useState(false)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('work_orders')
      .select('*, customer:customers(id, full_name, phone, email), motorcycle:motorcycles(id, brand, model, plate, motorcycle_year, color, vin)')
      .order('received_at', { ascending: false })

    if (error) alert(`No se pudieron cargar las órdenes: ${error.message}`)
    else {
      setOrders(data || [])
      setSelected(current => current ? (data || []).find(order => order.id === current.id) || null : null)
    }
    setLoading(false)
  }

  async function updateStatus(order, nextStatus) {
    if (nextStatus === 'Entregada') {
      prepareDelivery(order)
      return
    }
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
        delivered_at: nextStatus === 'Entregada' ? new Date().toISOString() : order.delivered_at
      })
      .eq('id', order.id)
      .select('*, customer:customers(id, full_name, phone, email), motorcycle:motorcycles(id, brand, model, plate, motorcycle_year, color, vin)')
      .single()

    if (error) return alert(`No se pudo cambiar el estado: ${error.message}`)
    setOrders(current => current.map(item => item.id === data.id ? data : item))
    setSelected(data)
    await loadOrderEvents(data.id)
  }

  async function loadOrderEvents(orderId) {
    const { data, error } = await supabase
      .from('work_order_events')
      .select('*')
      .eq('work_order_id', orderId)
      .order('created_at', { ascending: false })
    if (error) alert(`No se pudo cargar la línea de tiempo: ${error.message}`)
    else setOrderEvents(data || [])
  }

  async function openOrder(order) {
    setSelected(order)
    setNotes(order.internal_notes || '')
    setOrderPhotos([])
    setOrderSignatures([])
    setLoadingMedia(true)
    setDelivery(null)
    setShowDelivery(false)
    setDeliverySignature('')
    setOrderEvents([])
    setEventForm({ title: '', description: '', client_visible: false })

    const [photosResult, signaturesResult, deliveryResult, invoicesResult, eventsResult] = await Promise.all([
      supabase
        .from('work_order_photos')
        .select('*')
        .eq('work_order_id', order.id)
        .order('created_at'),
      supabase
        .from('work_order_signatures')
        .select('*')
        .eq('work_order_id', order.id)
        .order('signed_at'),
      supabase
        .from('work_order_deliveries')
        .select('*')
        .eq('work_order_id', order.id)
        .maybeSingle(),
      supabase
        .from('invoices')
        .select('total, amount_paid, status')
        .eq('work_order_id', order.id)
        .neq('status', 'Anulada'),
      supabase
        .from('work_order_events')
        .select('*')
        .eq('work_order_id', order.id)
        .order('created_at', { ascending: false })
    ])

    if (photosResult.error) alert(photosResult.error.message)
    if (signaturesResult.error) alert(signaturesResult.error.message)
    if (deliveryResult.error) alert(deliveryResult.error.message)
    if (invoicesResult.error) alert(invoicesResult.error.message)
    if (eventsResult.error) alert(eventsResult.error.message)

    const signRows = async rows => Promise.all(
      (rows || []).map(async row => {
        const { data } = await supabase.storage
          .from('work-order-media')
          .createSignedUrl(row.storage_path, 3600)
        return { ...row, signedUrl: data?.signedUrl || '' }
      })
    )

    setOrderPhotos(await signRows(photosResult.data))
    setOrderSignatures(await signRows(signaturesResult.data))
    setDelivery(deliveryResult.data || null)
    const balance = (invoicesResult.data || []).reduce(
      (total, invoice) => total + Number(invoice.total || 0) - Number(invoice.amount_paid || 0),
      0
    )
    setInvoiceBalance({
      hasInvoice: !!invoicesResult.data?.length,
      amount: balance
    })
    setOrderEvents(eventsResult.data || [])
    setLoadingMedia(false)
  }

  async function addTimelineEvent(event) {
    event.preventDefault()
    if (!selected || !eventForm.title.trim()) return
    setSavingEvent(true)
    const { error } = await supabase.from('work_order_events').insert({
      workshop_id: selected.workshop_id,
      work_order_id: selected.id,
      event_type: 'Nota',
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || null,
      status: selected.status,
      client_visible: eventForm.client_visible
    })
    setSavingEvent(false)
    if (error) {
      alert(`No se pudo guardar el evento: ${error.message}`)
      return
    }
    setEventForm({ title: '', description: '', client_visible: false })
    loadOrderEvents(selected.id)
  }

  function prepareDelivery(order = selected) {
    if (!order) return
    if (!['Lista para entregar', 'Prueba'].includes(order.status)) {
      alert('Primero cambia la orden a Prueba o Lista para entregar.')
      return
    }
    setDeliveryForm({
      ...emptyDelivery,
      receiver_name: order.customer?.full_name || '',
      mileage_out: order.mileage ?? '',
      fuel_level_out: order.fuel_level || '1/2',
      payment_condition: invoiceBalance?.hasInvoice
        ? invoiceBalance.amount > 0 ? 'Saldo pendiente autorizado' : 'Pagado'
        : 'Sin factura'
    })
    setDeliverySignature('')
    setShowDelivery(true)
  }

  function updateDelivery(field, value) {
    setDeliveryForm(current => ({ ...current, [field]: value }))
  }

  async function uploadDeliverySignature(order) {
    const blob = await fetch(deliverySignature).then(response => response.blob())
    const path = `${order.workshop_id}/${order.id}/signatures/delivery-client-${crypto.randomUUID()}.png`
    const { error: uploadError } = await supabase.storage
      .from('work-order-media')
      .upload(path, blob, { contentType: 'image/png', upsert: false })
    if (uploadError) throw uploadError

    const { error } = await supabase.from('work_order_signatures').insert({
      workshop_id: order.workshop_id,
      work_order_id: order.id,
      signer_type: 'Cliente',
      signer_name: deliveryForm.receiver_name.trim(),
      signature_stage: 'Entrega',
      storage_path: path
    })
    if (error) throw error
  }

  async function completeDelivery(event) {
    event.preventDefault()
    if (!selected || !deliverySignature) {
      alert('La firma de quien recibe es obligatoria.')
      return
    }
    setSavingDelivery(true)
    const { error } = await supabase.rpc('complete_work_order_delivery', {
      p_work_order_id: selected.id,
      p_receiver_name: deliveryForm.receiver_name,
      p_receiver_identification: deliveryForm.receiver_identification,
      p_mileage_out: deliveryForm.mileage_out ? Number(deliveryForm.mileage_out) : null,
      p_fuel_level_out: deliveryForm.fuel_level_out,
      p_work_summary: deliveryForm.work_summary,
      p_recommendations: deliveryForm.recommendations,
      p_returned_items: deliveryForm.returned_items,
      p_payment_condition: deliveryForm.payment_condition,
      p_customer_conformity: deliveryForm.customer_conformity,
      p_delivery_notes: deliveryForm.delivery_notes
    })
    if (error) {
      setSavingDelivery(false)
      alert(`No se pudo completar la entrega: ${error.message}`)
      return
    }
    try {
      await uploadDeliverySignature(selected)
    } catch (signatureError) {
      alert(`La entrega se guardó, pero la firma no pudo subirse: ${signatureError.message}`)
    }
    setSavingDelivery(false)
    setShowDelivery(false)
    await loadOrders()
    setSelected(null)
    alert('Motocicleta entregada correctamente.')
  }

  async function saveNotes() {
    if (!selected) return
    setSavingNotes(true)

    const { data, error } = await supabase
      .from('work_orders')
      .update({
        internal_notes: notes.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', selected.id)
      .select('*, customer:customers(id, full_name, phone, email), motorcycle:motorcycles(id, brand, model, plate, motorcycle_year, color, vin)')
      .single()

    setSavingNotes(false)

    if (error) {
      alert(`No se pudieron guardar las notas: ${error.message}`)
      return
    }

    setOrders(current => current.map(item => item.id === data.id ? data : item))
    setSelected(data)
  }

  function whatsappLink(phone) {
    const cleanPhone = String(phone || '').replace(/\D/g, '')
    const fullPhone = cleanPhone.startsWith('506') ? cleanPhone : `506${cleanPhone}`
    const name = selected?.customer?.full_name || ''
    const bike = `${selected?.motorcycle?.brand || ''} ${selected?.motorcycle?.model || ''}`.trim()
    const messages = {
      'Recepción': `Hola ${name}. Recibimos su ${bike} y creamos la orden ${selected?.order_number}. Le mantendremos informado.`,
      'Diagnóstico': `Hola ${name}. Ya iniciamos el diagnóstico de su ${bike}, orden ${selected?.order_number}.`,
      'Esperando aprobación': `Hola ${name}. La orden ${selected?.order_number} de su ${bike} está esperando su aprobación. Puede consultar el presupuesto en Mi moto: https://hcm-workshop-manager.vercel.app/mi-moto`,
      'Esperando repuestos': `Hola ${name}. La orden ${selected?.order_number} de su ${bike} está esperando repuestos. Le avisaremos cuando podamos continuar.`,
      'En reparación': `Hola ${name}. Los trabajos autorizados de su ${bike} ya están en proceso, orden ${selected?.order_number}.`,
      'Prueba': `Hola ${name}. Su ${bike} se encuentra en pruebas finales, orden ${selected?.order_number}.`,
      'Lista para entregar': `Hola ${name}. Su ${bike} está lista para entregar. Puede consultar los documentos en Mi moto: https://hcm-workshop-manager.vercel.app/mi-moto`,
      'Entregada': `Hola ${name}. Gracias por confiar en Herrera Custom Motorcycle. El historial de la orden ${selected?.order_number} quedó disponible en Mi moto: https://hcm-workshop-manager.vercel.app/mi-moto`,
      'Cancelada': `Hola ${name}. La orden ${selected?.order_number} de su ${bike} fue cancelada. Si tiene consultas, estamos para servirle.`
    }
    const message = encodeURIComponent(messages[selected?.status] || `Hola ${name}. Le escribimos de Herrera Custom Motorcycle sobre la orden ${selected?.order_number} de su ${bike}.`)
    return `https://wa.me/${fullPhone}?text=${message}`
  }

  const filteredOrders = useMemo(() => {
    const term = search.toLowerCase().trim()
    return orders.filter(order => {
      const matchesStatus = status === 'Todas' || order.status === status
      const text = [order.order_number, order.customer?.full_name, order.customer?.phone, order.motorcycle?.brand, order.motorcycle?.model, order.motorcycle?.plate]
        .filter(Boolean).join(' ').toLowerCase()
      return matchesStatus && text.includes(term)
    })
  }, [orders, search, status])

  const summary = useMemo(() => ({
    active: orders.filter(order => !['Entregada', 'Cancelada'].includes(order.status)).length,
    waiting: orders.filter(order => order.status === 'Esperando repuestos').length,
    ready: orders.filter(order => order.status === 'Lista para entregar').length,
    delivered: orders.filter(order => order.status === 'Entregada').length
  }), [orders])

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">CENTRO DE ÓRDENES</span>
            <h2>Órdenes de trabajo</h2>
            <p className="muted">Busca una orden, revisa su recepción y actualiza el estado del trabajo.</p>
          </div>
          <button className="secondary" type="button" onClick={loadOrders}>Actualizar</button>
        </div>

        <div className="order-summary-grid">
          <article><Wrench size={20} /><span>Activas</span><strong>{summary.active}</strong></article>
          <article><CalendarDays size={20} /><span>Esperando repuestos</span><strong>{summary.waiting}</strong></article>
          <article><Bike size={20} /><span>Listas para entregar</span><strong>{summary.ready}</strong></article>
          <article><UserRound size={20} /><span>Entregadas</span><strong>{summary.delivered}</strong></article>
        </div>

        <div className="work-order-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input type="search" placeholder="Buscar por OT, cliente, teléfono, placa o moto" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <select value={status} onChange={event => setStatus(event.target.value)}>
            <option>Todas</option>
            {statuses.map(item => <option key={item}>{item}</option>)}
          </select>
          <strong>{filteredOrders.length} órdenes</strong>
        </div>

        {loading ? <div className="empty">Cargando órdenes...</div> : filteredOrders.length ? (
          <div className="work-order-list">
            {filteredOrders.map(order => (
              <button type="button" className="work-order-card" key={order.id} onClick={() => openOrder(order)}>
                <div className="work-order-number"><strong>{order.order_number}</strong><small>{formatDate(order.received_at)}</small></div>
                <div><UserRound size={17} /><span>{order.customer?.full_name || 'Cliente no disponible'}</span></div>
                <div><Bike size={17} /><span>{order.motorcycle ? `${order.motorcycle.brand} ${order.motorcycle.model}` : 'Moto no disponible'}</span></div>
                <span className={`status-badge ${statusClass(order.status)}`}>{order.status}</span>
              </button>
            ))}
          </div>
        ) : <div className="empty">No hay órdenes que coincidan con la búsqueda.</div>}
      </section>

      {selected && (
        <div className="detail-backdrop" onClick={() => setSelected(null)}>
          <aside className="order-detail" onClick={event => event.stopPropagation()}>
            <button className="icon order-detail-close" type="button" onClick={() => setSelected(null)}><X size={20} /></button>
            <span className="eyebrow">ORDEN DE TRABAJO</span>
            <h2>{selected.order_number}</h2>
            <span className={`status-badge ${statusClass(selected.status)}`}>{selected.status}</span>

            {selected.customer?.phone && (
              <a
                className="whatsapp-action"
                href={whatsappLink(selected.customer.phone)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={18} />
                Escribir por WhatsApp
              </a>
            )}

            <button
              className="print-document-action"
              type="button"
              disabled={loadingMedia}
              onClick={() => printReceptionDocument({
                order: selected,
                photos: orderPhotos,
                signatures: orderSignatures,
                workshop,
                branding
              })}
            >
              <Printer size={18} />
              Imprimir recepción / Guardar PDF
            </button>

            <div className="order-detail-grid">
              <div><UserRound size={19} /><span>Cliente</span><strong>{selected.customer?.full_name || '—'}</strong><small>{selected.customer?.phone || '—'}</small></div>
              <div><Bike size={19} /><span>Motocicleta</span><strong>{selected.motorcycle ? `${selected.motorcycle.brand} ${selected.motorcycle.model}` : '—'}</strong><small>{selected.motorcycle?.plate ? `Placa ${selected.motorcycle.plate}` : 'Sin placa'}</small></div>
              <div><CalendarDays size={19} /><span>Ingreso</span><strong>{formatDate(selected.received_at)}</strong><small>{selected.mileage ?? '—'} km · Combustible {selected.fuel_level || '—'}</small></div>
            </div>

            <label className="order-status-control">Estado actual
              <select value={selected.status} disabled={!canEdit || selected.status === 'Entregada'} onChange={event => updateStatus(selected, event.target.value)}>
                {(selected.status === 'Entregada' ? statuses : editableStatuses).map(item => <option key={item}>{item}</option>)}
              </select>
            </label>

            {canDeliver && ['Lista para entregar', 'Prueba'].includes(selected.status) && !delivery && (
              <button className="delivery-launch" type="button" onClick={() => prepareDelivery(selected)}>
                <ClipboardCheck size={21} />
                <span><strong>Entregar motocicleta</strong><small>Registrar salida, conformidad y firma.</small></span>
              </button>
            )}

            {delivery && (
              <section className="detail-section delivery-record">
                <h3><CheckCircle2 size={19} /> Entrega completada</h3>
                <p><strong>Recibió:</strong> {delivery.receiver_name}</p>
                <p><strong>Fecha:</strong> {formatDate(delivery.delivered_at)}</p>
                <p><strong>Resumen:</strong> {delivery.work_summary}</p>
                <p><strong>Pago:</strong> {delivery.payment_condition}</p>
                <button className="print-document-action" type="button" onClick={() => printDeliveryDocument({ order: selected, delivery, signatures: orderSignatures, workshop, branding })}><Printer size={18} />Imprimir comprobante de entrega / Guardar PDF</button>
              </section>
            )}

            <section className="detail-section"><h3>Motivo del ingreso</h3><p>{selected.intake_notes || 'Sin información.'}</p></section>
            <section className="detail-section">
              <h3>Diagnóstico y notas internas</h3>
              <p className="muted">Este contenido es privado para el taller.</p>
              <textarea
                className="order-notes"
                readOnly={!canEdit}
                rows="7"
                placeholder="Pruebas realizadas, resultados, diagnóstico, repuestos necesarios y próximos pasos."
                value={notes}
                onChange={event => setNotes(event.target.value)}
              />
              {canEdit && <button
                className="primary compact"
                type="button"
                disabled={savingNotes}
                onClick={saveNotes}
              >
                <Save size={18} />
                {savingNotes ? 'Guardando...' : 'Guardar notas'}
              </button>}
            </section>

            <section className="detail-section order-timeline-section">
              <h3><History size={19} /> Línea de tiempo</h3>
              {canEdit && <form className="timeline-form" onSubmit={addTimelineEvent}>
                <input required placeholder="Título del evento" value={eventForm.title} onChange={event => setEventForm({ ...eventForm, title: event.target.value })} />
                <textarea rows="2" placeholder="Detalle u observación" value={eventForm.description} onChange={event => setEventForm({ ...eventForm, description: event.target.value })} />
                <label><input type="checkbox" checked={eventForm.client_visible} onChange={event => setEventForm({ ...eventForm, client_visible: event.target.checked })} />Visible para el cliente</label>
                <button className="secondary" disabled={savingEvent}>{savingEvent ? 'Guardando…' : 'Agregar evento'}</button>
              </form>}
              <div className="order-timeline">
                {orderEvents.map(item => (
                  <article key={item.id}>
                    <span className="timeline-dot" />
                    <div><strong>{item.title}</strong><small>{formatDate(item.created_at)} · {item.event_type}</small>{item.description && <p>{item.description}</p>}</div>
                    <span className="timeline-visibility" title={item.client_visible ? 'Visible para el cliente' : 'Solo taller'}>{item.client_visible ? <Eye size={16} /> : <EyeOff size={16} />}</span>
                  </article>
                ))}
                {!orderEvents.length && <p className="empty compact-empty">Todavía no hay eventos registrados.</p>}
              </div>
            </section>
            <section className="detail-section">
              <h3>Inspección de ingreso</h3>
              <p>
                Llave principal: {selected.main_key ? 'Sí' : 'No'} · Llave de repuesto: {selected.spare_key ? 'Sí' : 'No'}
              </p>
              {selected.accessories?.length ? (
                <ul className="inspection-summary">
                  {selected.accessories.map(item => <li key={item}>{item}</li>)}
                </ul>
              ) : (
                <p>Esta orden no tiene inspección registrada.</p>
              )}
            </section>

            <section className="detail-section">
              <h3>Fotografías y firmas</h3>
              {loadingMedia ? (
                <div className="empty compact-empty">Cargando evidencias...</div>
              ) : (
                <>
                  {orderPhotos.length ? (
                    <div className="order-photo-gallery">
                      {orderPhotos.map(photo => (
                        <a href={photo.signedUrl} target="_blank" rel="noreferrer" key={photo.id}>
                          <img src={photo.signedUrl} alt={photo.photo_type} />
                          <span>{photo.photo_type}</span>
                        </a>
                      ))}
                    </div>
                  ) : <p>Sin fotografías registradas.</p>}

                  {!!orderSignatures.length && (
                    <div className="order-signatures">
                      {orderSignatures.map(signature => (
                        <div key={signature.id}>
                          <span>{signature.signer_type}: {signature.signer_name || 'Sin nombre'}</span>
                          <img src={signature.signedUrl} alt={`Firma de ${signature.signer_name || signature.signer_type}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </aside>
        </div>
      )}

      {selected && showDelivery && (
        <div className="delivery-backdrop" onClick={() => setShowDelivery(false)}>
          <section className="delivery-modal" onClick={event => event.stopPropagation()}>
            <button className="icon delivery-close" type="button" onClick={() => setShowDelivery(false)}><X size={20} /></button>
            <span className="eyebrow">CIERRE DE LA ORDEN</span>
            <h2>Entrega de {selected.motorcycle?.brand} {selected.motorcycle?.model}</h2>
            <p className="muted">{selected.order_number} · {selected.customer?.full_name}</p>

            <div className={`delivery-balance ${invoiceBalance?.amount > 0 ? 'warning' : ''}`}>
              <span>Estado de cuenta</span>
              <strong>{invoiceBalance?.hasInvoice ? invoiceBalance.amount > 0 ? `Saldo pendiente: ₡${invoiceBalance.amount.toLocaleString('es-CR')}` : 'Factura pagada' : 'Sin factura registrada'}</strong>
            </div>

            <form className="delivery-form" onSubmit={completeDelivery}>
              <label>Nombre de quien recibe<input required value={deliveryForm.receiver_name} onChange={e => updateDelivery('receiver_name', e.target.value)} /></label>
              <label>Identificación (opcional)<input value={deliveryForm.receiver_identification} onChange={e => updateDelivery('receiver_identification', e.target.value)} /></label>
              <label>Kilometraje de salida<input type="number" min="0" value={deliveryForm.mileage_out} onChange={e => updateDelivery('mileage_out', e.target.value)} /></label>
              <label>Combustible de salida<select value={deliveryForm.fuel_level_out} onChange={e => updateDelivery('fuel_level_out', e.target.value)}><option>Vacío</option><option>1/4</option><option>1/2</option><option>3/4</option><option>Lleno</option></select></label>
              <label className="wide">Resumen de trabajos realizados<textarea required rows="4" value={deliveryForm.work_summary} onChange={e => updateDelivery('work_summary', e.target.value)} /></label>
              <label className="wide">Recomendaciones al cliente<textarea rows="3" value={deliveryForm.recommendations} onChange={e => updateDelivery('recommendations', e.target.value)} /></label>
              <label className="wide">Elementos devueltos<textarea rows="2" placeholder="Llaves, documentos u otros elementos." value={deliveryForm.returned_items} onChange={e => updateDelivery('returned_items', e.target.value)} /></label>
              <label>Condición de pago<select value={deliveryForm.payment_condition} onChange={e => updateDelivery('payment_condition', e.target.value)}><option>Pagado</option><option>Saldo pendiente autorizado</option><option>Sin factura</option></select></label>
              <label className="delivery-check"><input type="checkbox" checked={deliveryForm.customer_conformity} onChange={e => updateDelivery('customer_conformity', e.target.checked)} /> Cliente recibe conforme</label>
              <label className="wide">Observaciones de entrega<textarea rows="2" value={deliveryForm.delivery_notes} onChange={e => updateDelivery('delivery_notes', e.target.value)} /></label>
              <div className="wide"><strong>Firma de quien recibe</strong><SignaturePad value={deliverySignature} onChange={setDeliverySignature} /></div>
              <button className="primary wide" disabled={savingDelivery}>{savingDelivery ? 'Completando entrega…' : 'Confirmar entrega de motocicleta'}</button>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
