import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  Boxes,
  FileText,
  MessageCircle,
  Printer,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { printQuoteDocument } from '../lib/printDocuments'

const emptyItem = () => ({
  item_type: 'Repuesto',
  product_id: '',
  description: '',
  quantity: 1,
  unit_price: ''
})

const money = value =>
  new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

const todayPlus = days => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export default function Quotes({ workshop = null, branding = null }) {
  const [quotes, setQuotes] = useState([])
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [consuming, setConsuming] = useState(false)
  const [form, setForm] = useState({
    work_order_id: '',
    discount: 0,
    tax_rate: 13,
    valid_until: todayPlus(15),
    notes: '',
    items: [emptyItem()]
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [quotesResult, ordersResult, productsResult] = await Promise.all([
      supabase
        .from('quotes')
        .select(`
          *,
          items:quote_items(
            *,
            product:inventory_products(id, name, sku, stock, unit, sale_price)
          ),
          work_order:work_orders(
            order_number,
            customer:customers(full_name, phone),
            motorcycle:motorcycles(brand, model, plate)
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('work_orders')
        .select(`
          id,
          order_number,
          status,
          customer:customers(full_name, phone),
          motorcycle:motorcycles(brand, model, plate)
        `)
        .order('received_at', { ascending: false }),
      supabase
        .from('inventory_products')
        .select('id, sku, name, stock, unit, sale_price, active')
        .eq('active', true)
        .order('name')
    ])

    if (quotesResult.error) alert(quotesResult.error.message)
    if (ordersResult.error) alert(ordersResult.error.message)
    if (productsResult.error) alert(productsResult.error.message)
    setQuotes(quotesResult.data || [])
    setOrders(ordersResult.data || [])
    setProducts(productsResult.data || [])
  }

  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0
    )
    const discount = Math.min(Number(form.discount || 0), subtotal)
    const taxable = Math.max(subtotal - discount, 0)
    const taxAmount = taxable * (Number(form.tax_rate || 0) / 100)
    return { subtotal, discount, taxAmount, total: taxable + taxAmount }
  }, [form.items, form.discount, form.tax_rate])

  const quotedOrderIds = useMemo(
    () => new Set(quotes.map(quote => quote.work_order_id)),
    [quotes]
  )

  const availableOrders = orders.filter(order => !quotedOrderIds.has(order.id))

  const filteredQuotes = useMemo(() => {
    const term = search.toLowerCase().trim()
    return quotes.filter(quote =>
      [
        quote.quote_number,
        quote.work_order?.order_number,
        quote.work_order?.customer?.full_name,
        quote.work_order?.motorcycle?.brand,
        quote.work_order?.motorcycle?.model,
        quote.work_order?.motorcycle?.plate,
        quote.status
      ].filter(Boolean).join(' ').toLowerCase().includes(term)
    )
  }, [quotes, search])

  function updateItem(index, field, value) {
    setForm(current => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }))
  }

  function selectProduct(index, productId) {
    const product = products.find(item => item.id === productId)
    setForm(current => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              product_id: productId,
              description: product?.name || item.description,
              unit_price: product?.sale_price ?? item.unit_price
            }
          : item
      )
    }))
  }

  function updateItemType(index, itemType) {
    setForm(current => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              item_type: itemType,
              product_id: itemType === 'Repuesto' ? item.product_id : ''
            }
          : item
      )
    }))
  }

  function removeItem(index) {
    setForm(current => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index)
    }))
  }

  function resetForm() {
    setForm({
      work_order_id: '',
      discount: 0,
      tax_rate: 13,
      valid_until: todayPlus(15),
      notes: '',
      items: [emptyItem()]
    })
    setShowForm(false)
  }

  async function saveQuote(event) {
    event.preventDefault()
    const validItems = form.items.filter(item => item.description.trim())
    if (!validItems.length) return alert('Agrega al menos una línea al presupuesto.')
    setSaving(true)

    const { data: quote, error } = await supabase
      .from('quotes')
      .insert({
        work_order_id: form.work_order_id,
        status: 'Borrador',
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax_rate: Number(form.tax_rate || 0),
        tax_amount: totals.taxAmount,
        total: totals.total,
        notes: form.notes.trim() || null,
        valid_until: form.valid_until || null
      })
      .select()
      .single()

    if (error) {
      setSaving(false)
      alert(`No se pudo crear el presupuesto: ${error.message}`)
      return
    }

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(
        validItems.map(item => ({
          quote_id: quote.id,
          item_type: item.item_type,
          product_id: item.item_type === 'Repuesto'
            ? item.product_id || null
            : null,
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price || 0)
        }))
      )

    if (itemsError) {
      await supabase.from('quotes').delete().eq('id', quote.id)
      setSaving(false)
      alert(`No se pudieron guardar las líneas: ${itemsError.message}`)
      return
    }

    setSaving(false)
    resetForm()
    load()
  }

  async function updateStatus(quote, status) {
    const { data, error } = await supabase
      .from('quotes')
      .update({
        status,
        updated_at: new Date().toISOString(),
        sent_at: status === 'Enviado' ? new Date().toISOString() : quote.sent_at,
        approved_at: status === 'Aprobado' ? new Date().toISOString() : quote.approved_at
      })
      .eq('id', quote.id)
      .select(`
        *,
        items:quote_items(
          *,
          product:inventory_products(id, name, sku, stock, unit, sale_price)
        ),
        work_order:work_orders(
          order_number,
          customer:customers(full_name, phone),
          motorcycle:motorcycles(brand, model, plate)
        )
      `)
      .single()

    if (error) return alert(error.message)
    setQuotes(current => current.map(item => item.id === data.id ? data : item))
    setSelected(data)
  }

  async function consumeInventory(quote) {
    const pendingItems = (quote.items || []).filter(
      item => item.product_id && !item.inventory_deducted
    )

    if (!pendingItems.length) {
      alert('Este presupuesto no tiene repuestos pendientes de descontar.')
      return
    }

    const confirmed = window.confirm(
      `Se descontarán ${pendingItems.length} repuestos del inventario y quedarán asociados a ${quote.work_order?.order_number}. ¿Continuar?`
    )
    if (!confirmed) return

    setConsuming(true)
    const { data, error } = await supabase.rpc('consume_quote_inventory', {
      p_quote_id: quote.id
    })
    setConsuming(false)

    if (error) {
      alert(`No se pudo descontar el inventario: ${error.message}`)
      return
    }

    alert(`${data} repuestos fueron descontados correctamente.`)
    setSelected(null)
    load()
  }

  function whatsappLink(quote) {
    const phone = String(quote.work_order?.customer?.phone || '').replace(/\D/g, '')
    const fullPhone = phone.startsWith('506') ? phone : `506${phone}`
    const lines = (quote.items || [])
      .map(item => `• ${item.description}: ${money(item.line_total)}`)
      .join('\n')
    const message = encodeURIComponent(
      `Hola ${quote.work_order?.customer?.full_name || ''}. Le compartimos el presupuesto ${quote.quote_number} para su ${quote.work_order?.motorcycle?.brand || ''} ${quote.work_order?.motorcycle?.model || ''}.\n\n${lines}\n\nTotal: ${money(quote.total)}\n\nHerrera Custom Motorcycle.`
    )
    return `https://wa.me/${fullPhone}?text=${message}`
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">PRESUPUESTOS</span>
            <h2>Cotizaciones del taller</h2>
            <p className="muted">Mano de obra, repuestos, descuentos e impuestos vinculados a cada OT.</p>
          </div>
          <button className="primary compact" type="button" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'Cerrar' : 'Nuevo presupuesto'}
          </button>
        </div>

        {showForm && (
          <form className="quote-form" onSubmit={saveQuote}>
            <label className="wide">Orden de trabajo
              <select required value={form.work_order_id} onChange={event => setForm({ ...form, work_order_id: event.target.value })}>
                <option value="">Seleccionar OT</option>
                {availableOrders.map(order => (
                  <option key={order.id} value={order.id}>
                    {order.order_number} · {order.customer?.full_name} · {order.motorcycle?.brand} {order.motorcycle?.model}
                  </option>
                ))}
              </select>
            </label>

            <div className="quote-items wide">
              <div className="quote-items-heading"><h3>Líneas del presupuesto</h3><button className="secondary compact" type="button" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}><Plus size={16} />Agregar línea</button></div>
              {form.items.map((item, index) => (
                <div className="quote-item-row" key={index}>
                  <select value={item.item_type} onChange={event => updateItemType(index, event.target.value)}>
                    <option>Mano de obra</option><option>Repuesto</option><option>Otro</option>
                  </select>
                  <select
                    disabled={item.item_type !== 'Repuesto'}
                    value={item.product_id}
                    onChange={event => selectProduct(index, event.target.value)}
                  >
                    <option value="">{item.item_type === 'Repuesto' ? 'Seleccionar inventario' : 'No aplica'}</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} · Stock {Number(product.stock).toLocaleString('es-CR')} {product.unit}
                      </option>
                    ))}
                  </select>
                  <input required placeholder="Descripción" value={item.description} onChange={event => updateItem(index, 'description', event.target.value)} />
                  <input required type="number" min="0.01" step="0.01" placeholder="Cantidad" value={item.quantity} onChange={event => updateItem(index, 'quantity', event.target.value)} />
                  <input required type="number" min="0" step="0.01" placeholder="Precio unitario" value={item.unit_price} onChange={event => updateItem(index, 'unit_price', event.target.value)} />
                  <strong>{money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</strong>
                  <button className="icon" type="button" disabled={form.items.length === 1} onClick={() => removeItem(index)}><Trash2 size={17} /></button>
                </div>
              ))}
            </div>

            <label>Descuento (₡)<input type="number" min="0" value={form.discount} onChange={event => setForm({ ...form, discount: event.target.value })} /></label>
            <label>IVA (%)<input type="number" min="0" step="0.01" value={form.tax_rate} onChange={event => setForm({ ...form, tax_rate: event.target.value })} /></label>
            <label>Válido hasta<input type="date" value={form.valid_until} onChange={event => setForm({ ...form, valid_until: event.target.value })} /></label>
            <label className="wide">Notas<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>

            <div className="quote-total-card wide">
              <Calculator size={27} />
              <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
              <div><span>Descuento</span><strong>- {money(totals.discount)}</strong></div>
              <div><span>IVA</span><strong>{money(totals.taxAmount)}</strong></div>
              <div className="grand-total"><span>Total</span><strong>{money(totals.total)}</strong></div>
            </div>

            <button className="primary" disabled={saving}>{saving ? 'Guardando presupuesto...' : 'Guardar presupuesto'}</button>
          </form>
        )}

        <div className="search-box quote-search"><Search size={18} /><input type="search" placeholder="Buscar presupuesto, OT, cliente, placa o moto" value={search} onChange={event => setSearch(event.target.value)} /></div>

        <div className="quote-list">
          {filteredQuotes.map(quote => (
            <button className="quote-card" type="button" key={quote.id} onClick={() => setSelected(quote)}>
              <FileText size={22} />
              <div><span>{quote.quote_number}</span><strong>{quote.work_order?.customer?.full_name}</strong><small>{quote.work_order?.order_number} · {quote.work_order?.motorcycle?.brand} {quote.work_order?.motorcycle?.model}</small></div>
              <span className={`quote-status ${quote.status.toLowerCase()}`}>{quote.status}</span>
              <strong>{money(quote.total)}</strong>
            </button>
          ))}
        </div>

        {!filteredQuotes.length && <div className="empty">Todavía no hay presupuestos registrados.</div>}
      </section>

      {selected && (
        <div className="detail-backdrop" onClick={() => setSelected(null)}>
          <aside className="order-detail quote-detail" onClick={event => event.stopPropagation()}>
            <button className="icon order-detail-close" type="button" onClick={() => setSelected(null)}><X size={20} /></button>
            <span className="eyebrow">PRESUPUESTO</span>
            <h2>{selected.quote_number}</h2>
            <p className="muted">{selected.work_order?.order_number} · {selected.work_order?.customer?.full_name}<br />{selected.work_order?.motorcycle?.brand} {selected.work_order?.motorcycle?.model}</p>

            <label className="order-status-control">Estado
              <select value={selected.status} onChange={event => updateStatus(selected, event.target.value)}>
                <option>Borrador</option><option>Enviado</option><option>Aprobado</option><option>Rechazado</option>
              </select>
            </label>

            <div className="quote-detail-items">
              {(selected.items || []).map(item => (
                <div key={item.id}>
                  <span>{item.item_type}{item.product ? ` · Stock ${Number(item.product.stock).toLocaleString('es-CR')} ${item.product.unit}` : ''}</span>
                  <strong>{item.description}</strong>
                  <small>{item.quantity} × {money(item.unit_price)}{item.product_id ? ` · ${item.inventory_deducted ? 'Ya descontado' : 'Pendiente de instalar'}` : ''}</small>
                  <b>{money(item.line_total)}</b>
                </div>
              ))}
            </div>

            <div className="quote-detail-totals">
              <span>Subtotal <strong>{money(selected.subtotal)}</strong></span>
              <span>Descuento <strong>- {money(selected.discount)}</strong></span>
              <span>IVA ({selected.tax_rate}%) <strong>{money(selected.tax_amount)}</strong></span>
              <span className="grand-total">Total <strong>{money(selected.total)}</strong></span>
            </div>

            {selected.notes && <section className="detail-section"><h3>Notas</h3><p>{selected.notes}</p></section>}

            <button className="print-document-action" type="button" onClick={() => printQuoteDocument({ quote: selected, workshop, branding })}><Printer size={18} />Imprimir presupuesto / Guardar PDF</button>

            {selected.status === 'Aprobado' && (selected.items || []).some(item => item.product_id && !item.inventory_deducted) && (
              <button
                className="consume-inventory-button"
                type="button"
                disabled={consuming}
                onClick={() => consumeInventory(selected)}
              >
                <Boxes size={19} />
                {consuming ? 'Descontando inventario...' : 'Descontar repuestos instalados'}
              </button>
            )}

            {selected.work_order?.customer?.phone && (
              <a className="whatsapp-action" href={whatsappLink(selected)} target="_blank" rel="noreferrer"><MessageCircle size={18} />Enviar por WhatsApp</a>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
