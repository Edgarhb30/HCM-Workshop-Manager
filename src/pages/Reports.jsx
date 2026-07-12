import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Bike,
  Download,
  FileText,
  Receipt,
  RefreshCw,
  WalletCards,
  Wrench
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const monthStart = () => {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
}

const localToday = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)

const money = value =>
  new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

const groupCount = (rows, getter) => {
  const result = new Map()
  rows.forEach(row => {
    const key = getter(row) || 'Sin definir'
    result.set(key, (result.get(key) || 0) + 1)
  })
  return [...result.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export default function Reports() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(localToday())
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [orders, setOrders] = useState([])
  const [appointments, setAppointments] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    if (from > to) {
      alert('La fecha inicial no puede ser posterior a la fecha final.')
      return
    }
    setLoading(true)
    const start = `${from}T00:00:00`
    const end = `${to}T23:59:59`

    const [invoiceResult, paymentResult, orderResult, appointmentResult, movementResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, status, total, amount_paid, issued_at, work_order:work_orders(order_number, customer:customers(full_name), motorcycle:motorcycles(brand, model, plate))')
        .gte('issued_at', start)
        .lte('issued_at', end)
        .order('issued_at'),
      supabase
        .from('invoice_payments')
        .select('id, amount, payment_method, paid_at, reference, invoice:invoices(invoice_number)')
        .gte('paid_at', start)
        .lte('paid_at', end)
        .order('paid_at'),
      supabase
        .from('work_orders')
        .select('id, order_number, status, received_at, motorcycle:motorcycles(brand, model), customer:customers(full_name)')
        .gte('received_at', start)
        .lte('received_at', end)
        .order('received_at'),
      supabase
        .from('appointments')
        .select('id, service, status, appointment_date')
        .gte('appointment_date', from)
        .lte('appointment_date', to),
      supabase
        .from('inventory_movements')
        .select('id, movement_type, quantity, created_at, product:inventory_products(name, cost_price, unit)')
        .eq('movement_type', 'Salida')
        .gte('created_at', start)
        .lte('created_at', end)
    ])

    const results = [invoiceResult, paymentResult, orderResult, appointmentResult, movementResult]
    const error = results.find(result => result.error)?.error
    if (error) alert(error.message)

    setInvoices(invoiceResult.data || [])
    setPayments(paymentResult.data || [])
    setOrders(orderResult.data || [])
    setAppointments(appointmentResult.data || [])
    setMovements(movementResult.data || [])
    setLoading(false)
  }

  const activeInvoices = invoices.filter(invoice => invoice.status !== 'Anulada')
  const billed = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const collected = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const pending = activeInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid),
    0
  )
  const averageTicket = activeInvoices.length ? billed / activeInvoices.length : 0
  const inventoryCost = movements.reduce(
    (sum, movement) =>
      sum + Number(movement.quantity) * Number(movement.product?.cost_price || 0),
    0
  )

  const orderStatuses = useMemo(
    () => groupCount(orders, order => order.status),
    [orders]
  )
  const motorcycleBrands = useMemo(
    () => groupCount(orders, order => order.motorcycle?.brand).slice(0, 6),
    [orders]
  )
  const services = useMemo(
    () => groupCount(appointments, appointment => appointment.service).slice(0, 6),
    [appointments]
  )
  const paymentMethods = useMemo(
    () => {
      const grouped = new Map()
      payments.forEach(payment => {
        grouped.set(
          payment.payment_method,
          (grouped.get(payment.payment_method) || 0) + Number(payment.amount)
        )
      })
      return [...grouped.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
    },
    [payments]
  )

  function exportCsv() {
    const lines = [
      ['Tipo', 'Documento', 'Fecha', 'Cliente', 'Motocicleta', 'Estado', 'Total', 'Pagado'],
      ...invoices.map(invoice => [
        'Factura',
        invoice.invoice_number,
        new Date(invoice.issued_at).toLocaleDateString('es-CR'),
        invoice.work_order?.customer?.full_name || '',
        `${invoice.work_order?.motorcycle?.brand || ''} ${invoice.work_order?.motorcycle?.model || ''}`.trim(),
        invoice.status,
        invoice.total,
        invoice.amount_paid
      ]),
      ...payments.map(payment => [
        `Pago ${payment.payment_method}`,
        payment.invoice?.invoice_number || '',
        new Date(payment.paid_at).toLocaleDateString('es-CR'),
        '', '', 'Recibido', payment.amount, payment.amount
      ])
    ]

    const csv = lines
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `hcm-reporte-${from}-${to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function BarList({ rows, moneyValues = false }) {
    const max = Math.max(...rows.map(row => row.value), 1)
    return rows.length ? (
      <div className="report-bars">
        {rows.map(row => (
          <div key={row.label}>
            <div><span>{row.label}</span><strong>{moneyValues ? money(row.value) : row.value}</strong></div>
            <div className="report-bar-track"><span style={{ width: `${Math.max((row.value / max) * 100, 4)}%` }} /></div>
          </div>
        ))}
      </div>
    ) : <div className="empty compact-empty">No hay datos en este periodo.</div>
  }

  return (
    <section className="panel reports-page">
      <div className="panel-title">
        <div>
          <span className="eyebrow">REPORTES</span>
          <h2>Rendimiento del taller</h2>
          <p className="muted">Información financiera y operativa aislada para este taller.</p>
        </div>
        <button className="secondary compact" type="button" onClick={exportCsv}><Download size={17} />Exportar CSV</button>
      </div>

      <div className="report-filters">
        <label>Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
        <label>Hasta<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
        <button className="primary compact" type="button" onClick={load}><RefreshCw size={17} />Aplicar fechas</button>
      </div>

      {loading ? <div className="empty">Preparando reporte...</div> : (
        <>
          <div className="report-kpis">
            <article><Receipt size={22} /><span>Facturado</span><strong>{money(billed)}</strong></article>
            <article><WalletCards size={22} /><span>Pagos recibidos</span><strong>{money(collected)}</strong></article>
            <article className={pending ? 'warning' : ''}><FileText size={22} /><span>Saldo pendiente</span><strong>{money(pending)}</strong></article>
            <article><Wrench size={22} /><span>Órdenes recibidas</span><strong>{orders.length}</strong></article>
            <article><BarChart3 size={22} /><span>Ticket promedio</span><strong>{money(averageTicket)}</strong></article>
            <article><Bike size={22} /><span>Repuestos consumidos</span><strong>{money(inventoryCost)}</strong></article>
          </div>

          <div className="report-grid">
            <section className="report-card"><h3>Estados de las órdenes</h3><BarList rows={orderStatuses} /></section>
            <section className="report-card"><h3>Pagos por método</h3><BarList rows={paymentMethods} moneyValues /></section>
            <section className="report-card"><h3>Marcas más atendidas</h3><BarList rows={motorcycleBrands} /></section>
            <section className="report-card"><h3>Servicios más solicitados</h3><BarList rows={services} /></section>
          </div>

          <section className="report-card report-table-card">
            <h3>Facturas del periodo</h3>
            {invoices.length ? (
              <div className="table-wrap"><table><thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Pagado</th></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.id}><td>{invoice.invoice_number}</td><td>{new Date(invoice.issued_at).toLocaleDateString('es-CR')}</td><td>{invoice.work_order?.customer?.full_name || '—'}</td><td>{invoice.status}</td><td>{money(invoice.total)}</td><td>{money(invoice.amount_paid)}</td></tr>)}</tbody></table></div>
            ) : <div className="empty compact-empty">No hay facturas en este periodo.</div>}
          </section>
        </>
      )}
    </section>
  )
}
