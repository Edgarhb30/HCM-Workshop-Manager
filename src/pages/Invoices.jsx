import { useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  CreditCard,
  FileCheck2,
  MessageCircle,
  Printer,
  Plus,
  Receipt,
  Search,
  WalletCards,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { printInvoiceDocument } from '../lib/printDocuments'

const money = value =>
  new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

const invoiceSelect = `
  *,
  items:invoice_items(*),
  payments:invoice_payments(*),
    work_order:work_orders(
    order_number,
    customer:customers(full_name, phone, email, fiscal_identification_type, fiscal_identification_number, fiscal_economic_activity_code),
    motorcycle:motorcycles(brand, model, plate)
  ),
  quote:quotes(quote_number)
`

export default function Invoices({ workshop = null, branding = null, role }) {
  const canManage = ['owner', 'admin', 'reception'].includes(role)
  const [invoices, setInvoices] = useState([])
  const [approvedQuotes, setApprovedQuotes] = useState([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState('')
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [fiscalType, setFiscalType] = useState('04')
  const [checkingFiscal, setCheckingFiscal] = useState(false)
  const [fiscalPreview, setFiscalPreview] = useState(null)
  const [cabysItemId, setCabysItemId] = useState('')
  const [cabysQuery, setCabysQuery] = useState('')
  const [cabysResults, setCabysResults] = useState([])
  const [searchingCabys, setSearchingCabys] = useState(false)
  const [cabysSearched, setCabysSearched] = useState(false)
  const [payment, setPayment] = useState({
    amount: '',
    payment_method: 'SINPE',
    reference: '',
    notes: ''
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [invoicesResult, quotesResult] = await Promise.all([
      supabase
        .from('invoices')
        .select(invoiceSelect)
        .order('issued_at', { ascending: false }),
      supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          total,
          status,
          work_order:work_orders(
            order_number,
            customer:customers(full_name),
            motorcycle:motorcycles(brand, model)
          )
        `)
        .eq('status', 'Aprobado')
        .order('created_at', { ascending: false })
    ])

    if (invoicesResult.error) alert(invoicesResult.error.message)
    if (quotesResult.error) alert(quotesResult.error.message)
    setInvoices(invoicesResult.data || [])
    setApprovedQuotes(quotesResult.data || [])
  }

  async function fetchInvoice(id) {
    const { data, error } = await supabase
      .from('invoices')
      .select(invoiceSelect)
      .eq('id', id)
      .single()

    if (error) {
      alert(error.message)
      return null
    }
    return data
  }

  async function createInvoice(event) {
    event.preventDefault()
    setCreating(true)

    const { data: invoiceId, error } = await supabase.rpc(
      'create_invoice_from_quote',
      { p_quote_id: selectedQuote }
    )

    setCreating(false)
    if (error) {
      alert(`No se pudo crear la factura: ${error.message}`)
      return
    }

    setSelectedQuote('')
    setShowCreate(false)
    await load()
    const invoice = await fetchInvoice(invoiceId)
    if (invoice) openInvoice(invoice)
  }

  function openInvoice(invoice) {
    const balance = Number(invoice.total) - Number(invoice.amount_paid)
    setSelected(invoice)
    setFiscalType(invoice.work_order?.customer?.fiscal_identification_number ? '01' : '04')
    setFiscalPreview(null)
    setCabysItemId(invoice.items?.find(item => !item.cabys_code)?.id || invoice.items?.[0]?.id || '')
    setCabysQuery(invoice.items?.find(item => !item.cabys_code)?.description || '')
    setCabysResults([])
    setCabysSearched(false)
    setPayment({
      amount: balance > 0 ? String(balance) : '',
      payment_method: 'SINPE',
      reference: '',
      notes: ''
    })
  }

  async function checkFiscalDraft() {
    if (!selected) return
    setCheckingFiscal(true)
    setFiscalPreview(null)
    const { data, error } = await supabase.functions.invoke('hacienda-connection', {
      body: { action: 'preview', invoice_id: selected.id, document_type: fiscalType }
    })
    setCheckingFiscal(false)
    if (error || !data?.ok) return alert(data?.error || error?.message || 'No fue posible revisar el borrador fiscal.')
    setFiscalPreview(data)
  }

  async function downloadXmlPreview() {
    if (!selected) return
    setCheckingFiscal(true)
    const { data, error } = await supabase.functions.invoke('hacienda-connection', {
      body: { action: 'xml_preview', invoice_id: selected.id, document_type: fiscalType }
    })
    setCheckingFiscal(false)
    if (error || !data?.ok || !data?.xml) return alert(data?.error || data?.message || error?.message || 'No fue posible generar el XML.')
    const blob = new Blob([data.xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `PRUEBA-${data.consecutive}.xml`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function searchCabys(event) {
    event.preventDefault()
    if (cabysQuery.trim().length < 3) return alert('Escribe al menos tres letras para buscar.')
    setSearchingCabys(true); setCabysResults([]); setCabysSearched(false)
    const { data, error } = await supabase.functions.invoke('hacienda-connection', {
      body: { action: 'cabys_search', query: cabysQuery.trim() }
    })
    setSearchingCabys(false)
    if (error || !data?.ok) return alert(data?.error || error?.message || 'No fue posible consultar CABYS.')
    setCabysResults(data.results || [])
    setCabysSearched(true)
  }

  async function chooseCabys(result) {
    if (!cabysItemId) return alert('Selecciona primero la línea de la factura.')
    const taxRateCodes = { 0: '01', 0.5: '09', 1: '02', 2: '03', 4: '04', 8: '07', 13: '08' }
    const { error } = await supabase.from('invoice_items').update({
      cabys_code: result.code,
      fiscal_tax_rate: result.tax_rate,
      tax_rate_code: taxRateCodes[result.tax_rate] || '08'
    }).eq('id', cabysItemId)
    if (error) return alert(`No se pudo guardar el CABYS: ${error.message}`)
    const updated = await fetchInvoice(selected.id)
    if (updated) {
      setInvoices(current => current.map(item => item.id === updated.id ? updated : item))
      openInvoice(updated)
      alert(`CABYS ${result.code} guardado correctamente.`)
    }
  }

  async function registerPayment(event) {
    event.preventDefault()
    if (!selected) return
    setSavingPayment(true)

    const { error } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: selected.id,
        amount: Number(payment.amount),
        payment_method: payment.payment_method,
        reference: payment.reference.trim() || null,
        notes: payment.notes.trim() || null
      })

    setSavingPayment(false)
    if (error) {
      alert(`No se pudo registrar el pago: ${error.message}`)
      return
    }

    const updated = await fetchInvoice(selected.id)
    if (updated) {
      setInvoices(current =>
        current.map(invoice => invoice.id === updated.id ? updated : invoice)
      )
      openInvoice(updated)
    }
  }

  async function cancelInvoice(invoice) {
    if (Number(invoice.amount_paid) > 0) {
      alert('No se puede anular una factura que ya tiene pagos registrados.')
      return
    }
    if (!window.confirm(`¿Anular ${invoice.invoice_number}?`)) return

    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'Anulada', updated_at: new Date().toISOString() })
      .eq('id', invoice.id)
      .select(invoiceSelect)
      .single()

    if (error) return alert(error.message)
    setInvoices(current => current.map(item => item.id === data.id ? data : item))
    setSelected(data)
  }

  function whatsappLink(invoice) {
    const phone = String(invoice.work_order?.customer?.phone || '').replace(/\D/g, '')
    const fullPhone = phone.startsWith('506') ? phone : `506${phone}`
    const balance = Number(invoice.total) - Number(invoice.amount_paid)
    const message = encodeURIComponent(
      `Hola ${invoice.work_order?.customer?.full_name || ''}. Le compartimos el resumen ${invoice.invoice_number} de su ${invoice.work_order?.motorcycle?.brand || ''} ${invoice.work_order?.motorcycle?.model || ''}. Total: ${money(invoice.total)}. Saldo pendiente: ${money(balance)}. ${workshop?.name || 'El taller'}.`
    )
    return `https://wa.me/${fullPhone}?text=${message}`
  }

  const invoicedQuoteIds = useMemo(
    () => new Set(invoices.map(invoice => invoice.quote_id).filter(Boolean)),
    [invoices]
  )
  const availableQuotes = approvedQuotes.filter(quote => !invoicedQuoteIds.has(quote.id))

  const filteredInvoices = useMemo(() => {
    const term = search.toLowerCase().trim()
    return invoices.filter(invoice =>
      [
        invoice.invoice_number,
        invoice.quote?.quote_number,
        invoice.work_order?.order_number,
        invoice.work_order?.customer?.full_name,
        invoice.work_order?.motorcycle?.brand,
        invoice.work_order?.motorcycle?.model,
        invoice.work_order?.motorcycle?.plate,
        invoice.status
      ].filter(Boolean).join(' ').toLowerCase().includes(term)
    )
  }, [invoices, search])

  const summary = useMemo(() => ({
    billed: invoices.filter(invoice => invoice.status !== 'Anulada').reduce((sum, invoice) => sum + Number(invoice.total), 0),
    collected: invoices.filter(invoice => invoice.status !== 'Anulada').reduce((sum, invoice) => sum + Number(invoice.amount_paid), 0),
    pending: invoices.filter(invoice => invoice.status !== 'Anulada').reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid), 0),
    open: invoices.filter(invoice => ['Pendiente', 'Parcial'].includes(invoice.status)).length
  }), [invoices])

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">FACTURACIÓN INTERNA</span>
            <h2>Facturas y pagos</h2>
            <p className="muted">Control interno del taller. No sustituye el comprobante electrónico de Hacienda.</p>
          </div>
          {canManage && <button className="primary compact" type="button" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <X size={18} /> : <Plus size={18} />}
            {showCreate ? 'Cerrar' : 'Nueva factura'}
          </button>}
        </div>

        <div className="invoice-summary">
          <article><Receipt size={21} /><span>Facturado</span><strong>{money(summary.billed)}</strong></article>
          <article><Banknote size={21} /><span>Cobrado</span><strong>{money(summary.collected)}</strong></article>
          <article className={summary.pending ? 'warning' : ''}><WalletCards size={21} /><span>Por cobrar</span><strong>{money(summary.pending)}</strong></article>
          <article><FileCheck2 size={21} /><span>Facturas abiertas</span><strong>{summary.open}</strong></article>
        </div>

        {canManage && showCreate && (
          <form className="invoice-create-form" onSubmit={createInvoice}>
            <label>Presupuesto aprobado
              <select required value={selectedQuote} onChange={event => setSelectedQuote(event.target.value)}>
                <option value="">Seleccionar presupuesto</option>
                {availableQuotes.map(quote => (
                  <option key={quote.id} value={quote.id}>
                    {quote.quote_number} · {quote.work_order?.customer?.full_name} · {quote.work_order?.motorcycle?.brand} {quote.work_order?.motorcycle?.model} · {money(quote.total)}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" disabled={creating}>{creating ? 'Creando factura...' : 'Crear desde presupuesto'}</button>
            {!availableQuotes.length && <p className="muted">No hay presupuestos aprobados pendientes de facturar.</p>}
          </form>
        )}

        <div className="search-box invoice-search"><Search size={18} /><input type="search" placeholder="Buscar factura, OT, cliente, placa o estado" value={search} onChange={event => setSearch(event.target.value)} /></div>

        <div className="invoice-list">
          {filteredInvoices.map(invoice => {
            const balance = Number(invoice.total) - Number(invoice.amount_paid)
            return (
              <button className="invoice-card" type="button" key={invoice.id} onClick={() => openInvoice(invoice)}>
                <Receipt size={22} />
                <div><span>{invoice.invoice_number}</span><strong>{invoice.work_order?.customer?.full_name}</strong><small>{invoice.work_order?.order_number} · {invoice.work_order?.motorcycle?.brand} {invoice.work_order?.motorcycle?.model}</small></div>
                <span className={`invoice-status ${invoice.status.toLowerCase()}`}>{invoice.status}</span>
                <div className="invoice-balance"><strong>{money(invoice.total)}</strong><small>Saldo {money(balance)}</small></div>
              </button>
            )
          })}
        </div>

        {!filteredInvoices.length && <div className="empty">Todavía no hay facturas registradas.</div>}
      </section>

      {selected && (
        <div className="detail-backdrop" onClick={() => setSelected(null)}>
          <aside className="order-detail invoice-detail" onClick={event => event.stopPropagation()}>
            <button className="icon order-detail-close" type="button" onClick={() => setSelected(null)}><X size={20} /></button>
            <span className="eyebrow">FACTURA INTERNA</span>
            <h2>{selected.invoice_number}</h2>
            <span className={`invoice-status ${selected.status.toLowerCase()}`}>{selected.status}</span>
            <p className="muted">{selected.work_order?.customer?.full_name}<br />{selected.work_order?.motorcycle?.brand} {selected.work_order?.motorcycle?.model} · {selected.work_order?.order_number}</p>

            <div className="invoice-detail-items">
              {(selected.items || []).map(item => (
                <div key={item.id}><span>{item.item_type}</span><strong>{item.description}</strong><small>{item.quantity} × {money(item.unit_price)}</small><b>{money(item.line_total)}</b></div>
              ))}
            </div>

            <div className="invoice-totals">
              <span>Total <strong>{money(selected.total)}</strong></span>
              <span>Pagado <strong>{money(selected.amount_paid)}</strong></span>
              <span className="grand-total">Saldo <strong>{money(Number(selected.total) - Number(selected.amount_paid))}</strong></span>
            </div>

            <button className="print-document-action" type="button" onClick={() => printInvoiceDocument({ invoice: selected, workshop, branding })}><Printer size={18} />Imprimir factura / Guardar PDF</button>

            {canManage && selected.status !== 'Anulada' && <section className="fiscal-draft-check">
              <h3>Comprobante electrónico</h3>
              <p className="muted">Revisión previa. No envía a Hacienda ni consume consecutivo.</p>
              <label>Tipo de comprobante
                <select value={fiscalType} onChange={event => { setFiscalType(event.target.value); setFiscalPreview(null) }}>
                  <option value="04">Tiquete electrónico · consumidor final</option>
                  <option value="01">Factura electrónica · cliente identificado</option>
                </select>
              </label>
              <button className="secondary compact" type="button" disabled={checkingFiscal} onClick={checkFiscalDraft}><FileCheck2 size={17} />{checkingFiscal ? 'Revisando…' : 'Revisar borrador fiscal'}</button>
              {fiscalPreview && <div className={`fiscal-preview-result ${fiscalPreview.ready ? 'ready' : 'pending'}`}>
                <strong>{fiscalPreview.message}</strong>
                <span>{fiscalPreview.document_name} · {fiscalPreview.line_count} líneas · {money(fiscalPreview.total)}</span>
                {!!fiscalPreview.missing?.length && <ul>{fiscalPreview.missing.map(item => <li key={item}>{item}</li>)}</ul>}
                {fiscalPreview.ready && fiscalType === '04' && <button type="button" className="secondary compact" disabled={checkingFiscal} onClick={downloadXmlPreview}><FileCheck2 size={17} />Descargar XML de prueba</button>}
              </div>}
              <form className="cabys-search" onSubmit={searchCabys}>
                <h4>Buscador oficial CABYS</h4>
                <label>Línea de la factura<select value={cabysItemId} onChange={event => setCabysItemId(event.target.value)}>{(selected.items || []).map(item => <option key={item.id} value={item.id}>{item.description} {item.cabys_code ? `· ${item.cabys_code}` : '· sin CABYS'}</option>)}</select></label>
                <div className="cabys-search-row"><input value={cabysQuery} onChange={event => setCabysQuery(event.target.value)} placeholder="Ejemplo: mantenimiento motocicleta" /><button className="secondary compact" disabled={searchingCabys}>{searchingCabys ? 'Buscando…' : 'Buscar CABYS'}</button></div>
                <button type="button" className="cabys-suggestion" onClick={() => { setCabysQuery('mantenimiento motocicleta'); setCabysResults([{ code: '8714200000000', description: 'Servicios de mantenimiento y reparación de motocicletas', tax_rate: 13, category: 'Servicios de mantenimiento y reparación' }]); setCabysSearched(true) }}><strong>Sugerencia para trabajos generales de taller</strong><span>8714200000000 · Mantenimiento y reparación de motocicletas</span></button>
                {!!cabysResults.length && <div className="cabys-results">{cabysResults.map(result => <button type="button" key={result.code} onClick={() => chooseCabys(result)}><strong>{result.description}</strong><span>{result.code} · IVA {result.tax_rate}%</span>{result.category && <small>{result.category}</small>}</button>)}</div>}
                {cabysSearched && !cabysResults.length && <p className="muted">No hubo coincidencias. Prueba con menos palabras, por ejemplo “aceite”, “bujía” o “mantenimiento motocicleta”.</p>}
              </form>
            </section>}

            {canManage && !['Pagada', 'Anulada'].includes(selected.status) && (
              <form className="payment-form" onSubmit={registerPayment}>
                <h3>Registrar pago</h3>
                <label>Monto<input required type="number" min="1" max={Number(selected.total) - Number(selected.amount_paid)} value={payment.amount} onChange={event => setPayment({ ...payment, amount: event.target.value })} /></label>
                <label>Método<select value={payment.payment_method} onChange={event => setPayment({ ...payment, payment_method: event.target.value })}><option>Efectivo</option><option>SINPE</option><option>Tarjeta</option><option>Transferencia</option><option>Otro</option></select></label>
                <label>Referencia<input placeholder="Comprobante o referencia" value={payment.reference} onChange={event => setPayment({ ...payment, reference: event.target.value })} /></label>
                <label className="wide">Notas<textarea value={payment.notes} onChange={event => setPayment({ ...payment, notes: event.target.value })} /></label>
                <button className="primary compact" disabled={savingPayment}><CreditCard size={18} />{savingPayment ? 'Guardando pago...' : 'Registrar pago'}</button>
              </form>
            )}

            {!!selected.payments?.length && (
              <section className="record-section">
                <h3>Historial de pagos</h3>
                <div className="payment-history">
                  {[...selected.payments].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).map(item => (
                    <article key={item.id}><CreditCard size={18} /><div><strong>{money(item.amount)} · {item.payment_method}</strong><span>{new Date(item.paid_at).toLocaleString('es-CR')}</span><small>{item.reference || item.notes || 'Sin referencia'}</small></div></article>
                  ))}
                </div>
              </section>
            )}

            {selected.work_order?.customer?.phone && <a className="whatsapp-action" href={whatsappLink(selected)} target="_blank" rel="noreferrer"><MessageCircle size={18} />Enviar resumen por WhatsApp</a>}
            {canManage && selected.status !== 'Anulada' && Number(selected.amount_paid) === 0 && <button className="cancel-invoice" type="button" onClick={() => cancelInvoice(selected)}>Anular factura</button>}
          </aside>
        </div>
      )}
    </>
  )
}
