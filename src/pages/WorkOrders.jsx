import { useEffect, useMemo, useState } from 'react'
import { Bike, CalendarDays, Search, UserRound, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const statuses = ['Recepción', 'Diagnóstico', 'Esperando aprobación', 'Esperando repuestos', 'En reparación', 'Lista para entregar', 'Entregada', 'Cancelada']

const statusClass = status =>
  status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '-')

const formatDate = value => value
  ? new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—'

export default function WorkOrders() {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Todas')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

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
              <button type="button" className="work-order-card" key={order.id} onClick={() => setSelected(order)}>
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

            <div className="order-detail-grid">
              <div><UserRound size={19} /><span>Cliente</span><strong>{selected.customer?.full_name || '—'}</strong><small>{selected.customer?.phone || '—'}</small></div>
              <div><Bike size={19} /><span>Motocicleta</span><strong>{selected.motorcycle ? `${selected.motorcycle.brand} ${selected.motorcycle.model}` : '—'}</strong><small>{selected.motorcycle?.plate ? `Placa ${selected.motorcycle.plate}` : 'Sin placa'}</small></div>
              <div><CalendarDays size={19} /><span>Ingreso</span><strong>{formatDate(selected.received_at)}</strong><small>{selected.mileage ?? '—'} km · Combustible {selected.fuel_level || '—'}</small></div>
            </div>

            <label className="order-status-control">Estado actual
              <select value={selected.status} onChange={event => updateStatus(selected, event.target.value)}>
                {statuses.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>

            <section className="detail-section"><h3>Motivo del ingreso</h3><p>{selected.intake_notes || 'Sin información.'}</p></section>
            <section className="detail-section"><h3>Observaciones internas</h3><p>{selected.internal_notes || 'Sin observaciones.'}</p></section>
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
          </aside>
        </div>
      )}
    </>
  )
}
