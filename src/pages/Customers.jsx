import { useEffect, useMemo, useState } from 'react'
import {
  Bike,
  CalendarDays,
  Droplets,
  Eye,
  History,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const emptyForm = {
  full_name: '',
  phone: '',
  email: '',
  notes: ''
}

const formatDate = value => value
  ? new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(
      new Date(`${String(value).slice(0, 10)}T12:00:00`)
    )
  : '—'

export default function Customers({ role }) {
  const canEdit = ['owner', 'admin', 'reception'].includes(role)
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [selected, setSelected] = useState(null)
  const [motorcycles, setMotorcycles] = useState([])
  const [orders, setOrders] = useState([])
  const [oilChanges, setOilChanges] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState(emptyForm)

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return alert(error.message)
    setRows(data || [])
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)

    const { error } = await supabase.from('customers').insert({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      notes: form.notes.trim() || null
    })

    setSaving(false)
    if (error) return alert(error.message)
    setForm(emptyForm)
    setShow(false)
    load()
  }

  async function openCustomer(customer) {
    setSelected(customer)
    setEditing(false)
    setEditForm({
      full_name: customer.full_name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || ''
    })
    setLoadingDetail(true)
    setMotorcycles([])
    setOrders([])
    setOilChanges([])

    const [motorcyclesResult, ordersResult] = await Promise.all([
      supabase
        .from('motorcycles')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('work_orders')
        .select('id, order_number, status, received_at, intake_notes, motorcycle:motorcycles(brand, model, plate)')
        .eq('customer_id', customer.id)
        .order('received_at', { ascending: false })
    ])

    if (motorcyclesResult.error) alert(motorcyclesResult.error.message)
    if (ordersResult.error) alert(ordersResult.error.message)

    const customerMotorcycles = motorcyclesResult.data || []
    setMotorcycles(customerMotorcycles)
    setOrders(ordersResult.data || [])

    const ids = customerMotorcycles.map(motorcycle => motorcycle.id)
    if (ids.length) {
      const { data, error } = await supabase
        .from('oil_changes')
        .select('*, motorcycle:motorcycles(id, brand, model, plate, mileage)')
        .in('motorcycle_id', ids)
        .order('change_date', { ascending: false })

      if (error) alert(error.message)
      else setOilChanges(data || [])
    }

    setLoadingDetail(false)
  }

  async function saveCustomerChanges(event) {
    event.preventDefault()
    if (!selected) return
    setSavingEdit(true)

    const { data, error } = await supabase
      .from('customers')
      .update({
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim() || null,
        notes: editForm.notes.trim() || null
      })
      .eq('id', selected.id)
      .select()
      .single()

    setSavingEdit(false)
    if (error) {
      alert(`No se pudo actualizar el cliente: ${error.message}`)
      return
    }

    setRows(current =>
      current.map(customer => customer.id === data.id ? data : customer)
    )
    setSelected(data)
    setEditing(false)
  }

  const filteredRows = useMemo(() => {
    const term = search.toLowerCase().trim()
    return rows.filter(customer =>
      [customer.full_name, customer.phone, customer.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    )
  }, [rows, search])

  const latestOilByMotorcycle = useMemo(() => {
    const latest = new Map()
    for (const change of oilChanges) {
      if (!latest.has(change.motorcycle_id)) {
        latest.set(change.motorcycle_id, change)
      }
    }
    return latest
  }, [oilChanges])

  function whatsappLink(phone, message = '') {
    const cleanPhone = String(phone || '').replace(/\D/g, '')
    const fullPhone = cleanPhone.startsWith('506') ? cleanPhone : `506${cleanPhone}`
    return `https://wa.me/${fullPhone}${message ? `?text=${encodeURIComponent(message)}` : ''}`
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">CLIENTES</span>
            <h2>Base de clientes</h2>
            <p className="muted">Motocicletas, historial del taller y próximos mantenimientos.</p>
          </div>
          {canEdit && <button className="primary compact" type="button" onClick={() => setShow(!show)}>
            <Plus size={18} />Nuevo cliente
          </button>}
        </div>

        {canEdit && show && (
          <form className="inline-form" onSubmit={save}>
            <label>Nombre<input required value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} /></label>
            <label>Teléfono<input required value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Correo<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
            <label className="wide">Notas<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
            <button className="primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cliente'}</button>
          </form>
        )}

        <div className="customer-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input type="search" placeholder="Buscar por nombre, teléfono o correo" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <span className="customer-count">{filteredRows.length} clientes</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Notas</th><th>Acciones</th></tr></thead>
            <tbody>
              {filteredRows.map(customer => (
                <tr key={customer.id}>
                  <td><strong>{customer.full_name}</strong></td>
                  <td>{customer.phone}</td>
                  <td>{customer.email || '—'}</td>
                  <td>{customer.notes || '—'}</td>
                  <td>
                    <div className="customer-actions">
                      <button className="icon-action" type="button" title="Abrir expediente" onClick={() => openCustomer(customer)}><Eye size={18} /></button>
                      <a className="icon-action whatsapp" href={whatsappLink(customer.phone)} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><MessageCircle size={18} /></a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredRows.length && <div className="empty">No hay clientes que coincidan con la búsqueda.</div>}
      </section>

      {selected && (
        <div className="detail-backdrop" onClick={() => setSelected(null)}>
          <aside className="order-detail customer-detail" onClick={event => event.stopPropagation()}>
            <button className="icon order-detail-close" type="button" onClick={() => setSelected(null)}><X size={20} /></button>
            <span className="eyebrow">EXPEDIENTE DEL CLIENTE</span>
            <h2>{selected.full_name}</h2>

            {canEdit && <button
              className="secondary compact edit-customer-button"
              type="button"
              onClick={() => setEditing(!editing)}
            >
              {editing ? <X size={17} /> : <Pencil size={17} />}
              {editing ? 'Cancelar edición' : 'Editar datos'}
            </button>}

            {canEdit && editing && (
              <form className="customer-edit-form" onSubmit={saveCustomerChanges}>
                <label>Nombre
                  <input required value={editForm.full_name} onChange={event => setEditForm({ ...editForm, full_name: event.target.value })} />
                </label>
                <label>Teléfono
                  <input required value={editForm.phone} onChange={event => setEditForm({ ...editForm, phone: event.target.value })} />
                </label>
                <label>Correo
                  <input type="email" value={editForm.email} onChange={event => setEditForm({ ...editForm, email: event.target.value })} />
                </label>
                <label className="wide">Notas
                  <textarea value={editForm.notes} onChange={event => setEditForm({ ...editForm, notes: event.target.value })} />
                </label>
                <button className="primary" disabled={savingEdit}>
                  {savingEdit ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </form>
            )}

            <div className="customer-contact-card">
              <div><Phone size={18} /><span>Teléfono</span><strong>{selected.phone}</strong></div>
              <div><Mail size={18} /><span>Correo</span><strong>{selected.email || 'No registrado'}</strong></div>
            </div>

            <a
              className="whatsapp-action"
              href={whatsappLink(selected.phone, `Hola ${selected.full_name}. Le escribimos de Herrera Custom Motorcycle.`)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} />Escribir por WhatsApp
            </a>

            {loadingDetail ? <div className="empty">Cargando expediente...</div> : (
              <>
                <section className="record-section">
                  <div className="record-title"><div><Bike size={22} /><div><h3>Motocicletas</h3><p>{motorcycles.length} registradas</p></div></div></div>
                  {motorcycles.length ? (
                    <div className="customer-motorcycles">
                      {motorcycles.map(motorcycle => {
                        const oil = latestOilByMotorcycle.get(motorcycle.id)
                        return (
                          <article key={motorcycle.id}>
                            <div className="customer-motorcycle-heading">
                              <div><strong>{motorcycle.brand} {motorcycle.model}</strong><span>{motorcycle.plate || 'Sin placa'} · {motorcycle.mileage?.toLocaleString('es-CR') || '—'} km</span></div>
                              <Bike size={21} />
                            </div>
                            {oil ? (
                              <div className="customer-oil-status">
                                <Droplets size={17} />
                                <span>Último aceite: {formatDate(oil.change_date)}</span>
                                <strong>{oil.next_change_mileage ? `Próximo a ${oil.next_change_mileage.toLocaleString('es-CR')} km` : oil.next_change_date ? `Próximo ${formatDate(oil.next_change_date)}` : 'Sin próximo cambio definido'}</strong>
                              </div>
                            ) : <small>Sin cambios de aceite registrados.</small>}
                          </article>
                        )
                      })}
                    </div>
                  ) : <div className="empty compact-empty">Este cliente no tiene motocicletas registradas.</div>}
                </section>

                <section className="record-section">
                  <div className="record-title"><div><History size={22} /><div><h3>Historial del taller</h3><p>{orders.length} órdenes de trabajo</p></div></div></div>
                  {orders.length ? (
                    <div className="customer-order-history">
                      {orders.map(order => (
                        <article key={order.id}>
                          <CalendarDays size={18} />
                          <div><strong>{order.order_number} · {order.motorcycle?.brand} {order.motorcycle?.model}</strong><span>{formatDate(order.received_at)} · {order.status}</span><p>{order.intake_notes || 'Sin motivo registrado.'}</p></div>
                        </article>
                      ))}
                    </div>
                  ) : <div className="empty compact-empty">Todavía no hay órdenes de trabajo.</div>}
                </section>

                {selected.notes && (
                  <section className="record-section"><h3>Notas del cliente</h3><p className="muted">{selected.notes}</p></section>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
