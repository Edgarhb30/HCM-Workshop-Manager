import { useEffect, useMemo, useState } from 'react'
import {
  Bike,
  CalendarDays,
  Droplets,
  Gauge,
  History,
  Plus,
  Search,
  UserRound,
  Wrench,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)

const emptyMotorcycle = {
  customer_id: '',
  brand: '',
  model: '',
  motorcycle_year: '',
  plate: '',
  color: '',
  vin: '',
  mileage: ''
}

const emptyOilChange = motorcycle => ({
  change_date: today(),
  mileage: motorcycle?.mileage ?? '',
  oil_brand: '',
  oil_viscosity: '',
  quantity_ml: '',
  filter_changed: false,
  next_change_mileage: motorcycle?.mileage ? motorcycle.mileage + 3000 : '',
  next_change_date: '',
  notes: ''
})

const serviceTypes = [
  'Filtro de aceite', 'Filtro de aire', 'Ajuste de válvulas',
  'Líquido de frenos', 'Pastillas de freno', 'Refrigerante',
  'Bujías', 'Kit de arrastre', 'Llantas', 'Rodamientos',
  'Suspensión', 'Batería', 'Inyección / carburación',
  'Sistema eléctrico', 'Otro'
]

const emptyMaintenance = motorcycle => ({
  service_type: '',
  service_date: today(),
  mileage: motorcycle?.mileage ?? '',
  work_order_id: '',
  details: '',
  parts_used: '',
  next_service_mileage: '',
  next_service_date: '',
  technician_name: ''
})

const formatDate = value =>
  value
    ? new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(
        new Date(`${value}T12:00:00`)
      )
    : '—'

export default function Motorcycles() {
  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [form, setForm] = useState(emptyMotorcycle)
  const [selected, setSelected] = useState(null)
  const [orders, setOrders] = useState([])
  const [oilChanges, setOilChanges] = useState([])
  const [oilForm, setOilForm] = useState(emptyOilChange())
  const [showOilForm, setShowOilForm] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [savingOil, setSavingOil] = useState(false)
  const [maintenanceRecords, setMaintenanceRecords] = useState([])
  const [maintenanceForm, setMaintenanceForm] = useState(emptyMaintenance())
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [savingMaintenance, setSavingMaintenance] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [motorcyclesResult, customersResult] = await Promise.all([
      supabase
        .from('motorcycles')
        .select('*, customer:customers(id, full_name, phone, email)')
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('id, full_name').order('full_name')
    ])

    if (motorcyclesResult.error) alert(motorcyclesResult.error.message)
    if (customersResult.error) alert(customersResult.error.message)
    setRows(motorcyclesResult.data || [])
    setCustomers(customersResult.data || [])
  }

  async function save(event) {
    event.preventDefault()
    const payload = {
      ...form,
      motorcycle_year: form.motorcycle_year ? Number(form.motorcycle_year) : null,
      mileage: form.mileage ? Number(form.mileage) : null,
      plate: form.plate.trim().toUpperCase() || null,
      color: form.color.trim() || null,
      vin: form.vin.trim().toUpperCase() || null
    }

    const { error } = await supabase.from('motorcycles').insert(payload)
    if (error) return alert(error.message)
    setShow(false)
    setForm(emptyMotorcycle)
    load()
  }

  async function openMotorcycle(motorcycle) {
    setSelected(motorcycle)
    setShowOilForm(false)
    setOilForm(emptyOilChange(motorcycle))
    setMaintenanceForm(emptyMaintenance(motorcycle))
    setLoadingDetail(true)

    const [ordersResult, oilResult, maintenanceResult] = await Promise.all([
      supabase
        .from('work_orders')
        .select('id, order_number, status, received_at, mileage, intake_notes')
        .eq('motorcycle_id', motorcycle.id)
        .order('received_at', { ascending: false }),
      supabase
        .from('oil_changes')
        .select('*')
        .eq('motorcycle_id', motorcycle.id)
        .order('change_date', { ascending: false }),
      supabase
        .from('maintenance_records')
        .select('*')
        .eq('motorcycle_id', motorcycle.id)
        .order('service_date', { ascending: false })
    ])

    if (ordersResult.error) alert(ordersResult.error.message)
    if (oilResult.error) alert(oilResult.error.message)
    if (maintenanceResult.error) alert(maintenanceResult.error.message)
    setOrders(ordersResult.data || [])
    setOilChanges(oilResult.data || [])
    setMaintenanceRecords(maintenanceResult.data || [])
    setLoadingDetail(false)
  }

  async function saveOilChange(event) {
    event.preventDefault()
    if (!selected) return
    setSavingOil(true)

    const payload = {
      motorcycle_id: selected.id,
      change_date: oilForm.change_date,
      mileage: Number(oilForm.mileage),
      oil_brand: oilForm.oil_brand.trim() || null,
      oil_viscosity: oilForm.oil_viscosity.trim() || null,
      quantity_ml: oilForm.quantity_ml ? Number(oilForm.quantity_ml) : null,
      filter_changed: oilForm.filter_changed,
      next_change_mileage: oilForm.next_change_mileage
        ? Number(oilForm.next_change_mileage)
        : null,
      next_change_date: oilForm.next_change_date || null,
      notes: oilForm.notes.trim() || null
    }

    const { data, error } = await supabase
      .from('oil_changes')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setSavingOil(false)
      alert(`No se pudo guardar el cambio de aceite: ${error.message}`)
      return
    }

    if (!selected.mileage || payload.mileage >= selected.mileage) {
      await supabase
        .from('motorcycles')
        .update({ mileage: payload.mileage })
        .eq('id', selected.id)

      const updated = { ...selected, mileage: payload.mileage }
      setSelected(updated)
      setRows(current => current.map(item => item.id === updated.id ? updated : item))
    }

    setOilChanges(current => [data, ...current])
    setOilForm(emptyOilChange({ ...selected, mileage: payload.mileage }))
    setShowOilForm(false)
    setSavingOil(false)
  }

  async function saveMaintenance(event) {
    event.preventDefault()
    if (!selected) return
    setSavingMaintenance(true)

    const payload = {
      motorcycle_id: selected.id,
      work_order_id: maintenanceForm.work_order_id || null,
      service_type: maintenanceForm.service_type,
      service_date: maintenanceForm.service_date,
      mileage: maintenanceForm.mileage ? Number(maintenanceForm.mileage) : null,
      details: maintenanceForm.details.trim() || null,
      parts_used: maintenanceForm.parts_used.trim() || null,
      next_service_mileage: maintenanceForm.next_service_mileage
        ? Number(maintenanceForm.next_service_mileage)
        : null,
      next_service_date: maintenanceForm.next_service_date || null,
      technician_name: maintenanceForm.technician_name.trim() || null
    }

    const { data, error } = await supabase
      .from('maintenance_records')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setSavingMaintenance(false)
      alert(`No se pudo guardar el mantenimiento: ${error.message}`)
      return
    }

    if (payload.mileage !== null && (!selected.mileage || payload.mileage >= selected.mileage)) {
      await supabase.from('motorcycles').update({ mileage: payload.mileage }).eq('id', selected.id)
      const updated = { ...selected, mileage: payload.mileage }
      setSelected(updated)
      setRows(current => current.map(item => item.id === updated.id ? updated : item))
    }

    setMaintenanceRecords(current => [data, ...current])
    setMaintenanceForm(emptyMaintenance({ ...selected, mileage: payload.mileage ?? selected.mileage }))
    setShowMaintenanceForm(false)
    setSavingMaintenance(false)
  }

  const filteredRows = useMemo(() => {
    const term = search.toLowerCase().trim()
    return rows.filter(motorcycle =>
      [
        motorcycle.brand,
        motorcycle.model,
        motorcycle.plate,
        motorcycle.vin,
        motorcycle.customer?.full_name
      ].filter(Boolean).join(' ').toLowerCase().includes(term)
    )
  }, [rows, search])

  const lastOilChange = oilChanges[0]
  const latestMaintenance = Array.from(
    maintenanceRecords.reduce((items, record) => {
      if (!items.has(record.service_type)) items.set(record.service_type, record)
      return items
    }, new Map()).values()
  )

  function maintenanceDue(record) {
    const mileageDue = record.next_service_mileage && selected?.mileage >= record.next_service_mileage
    const dateDue = record.next_service_date && record.next_service_date <= today()
    if (mileageDue || dateDue) return 'Vencido'
    if (record.next_service_mileage && selected?.mileage) {
      const remaining = record.next_service_mileage - selected.mileage
      if (remaining <= 500) return `Faltan ${remaining.toLocaleString('es-CR')} km`
    }
    if (record.next_service_date) return `Próximo ${formatDate(record.next_service_date)}`
    if (record.next_service_mileage) return `Próximo ${record.next_service_mileage.toLocaleString('es-CR')} km`
    return 'Sin próxima fecha'
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">MOTOCICLETAS</span>
            <h2>Expedientes técnicos</h2>
            <p className="muted">Historial del taller y control de cambios de aceite.</p>
          </div>
          <button className="primary compact" type="button" onClick={() => setShow(!show)}>
            <Plus size={18} />Nueva moto
          </button>
        </div>

        {show && (
          <form className="inline-form" onSubmit={save}>
            <label>Propietario
              <select required value={form.customer_id} onChange={event => setForm({ ...form, customer_id: event.target.value })}>
                <option value="">Seleccionar</option>
                {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}
              </select>
            </label>
            <label>Marca<input required value={form.brand} onChange={event => setForm({ ...form, brand: event.target.value })} /></label>
            <label>Modelo<input required value={form.model} onChange={event => setForm({ ...form, model: event.target.value })} /></label>
            <label>Año<input type="number" value={form.motorcycle_year} onChange={event => setForm({ ...form, motorcycle_year: event.target.value })} /></label>
            <label>Placa<input value={form.plate} onChange={event => setForm({ ...form, plate: event.target.value.toUpperCase() })} /></label>
            <label>Color<input value={form.color} onChange={event => setForm({ ...form, color: event.target.value })} /></label>
            <label>VIN<input value={form.vin} onChange={event => setForm({ ...form, vin: event.target.value })} /></label>
            <label>Kilometraje<input type="number" min="0" value={form.mileage} onChange={event => setForm({ ...form, mileage: event.target.value })} /></label>
            <button className="primary">Guardar motocicleta</button>
          </form>
        )}

        <div className="search-box motorcycle-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Buscar por propietario, placa, marca, modelo o VIN"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        <div className="moto-grid">
          {filteredRows.map(motorcycle => (
            <button className="moto-card moto-card-button" type="button" key={motorcycle.id} onClick={() => openMotorcycle(motorcycle)}>
              <span className="eyebrow">{motorcycle.plate || 'SIN PLACA'}</span>
              <h3>{motorcycle.brand} {motorcycle.model}</h3>
              <p>{motorcycle.motorcycle_year || 'Año no registrado'} · {motorcycle.color || 'Color no registrado'}</p>
              <small>
                Propietario: {motorcycle.customer?.full_name || '—'}
                <br />Kilometraje: {motorcycle.mileage?.toLocaleString('es-CR') || '—'} km
              </small>
              <span className="open-record">Abrir expediente →</span>
            </button>
          ))}
        </div>

        {!filteredRows.length && <div className="empty">No hay motocicletas que coincidan con la búsqueda.</div>}
      </section>

      {selected && (
        <div className="detail-backdrop" onClick={() => setSelected(null)}>
          <aside className="order-detail motorcycle-detail" onClick={event => event.stopPropagation()}>
            <button className="icon order-detail-close" type="button" onClick={() => setSelected(null)}><X size={20} /></button>
            <span className="eyebrow">EXPEDIENTE TÉCNICO</span>
            <h2>{selected.brand} {selected.model}</h2>
            <p className="muted">{selected.plate || 'Sin placa'} · {selected.motorcycle_year || 'Año no registrado'}</p>

            <div className="motorcycle-facts">
              <article><UserRound size={20} /><span>Propietario</span><strong>{selected.customer?.full_name || '—'}</strong></article>
              <article><Gauge size={20} /><span>Kilometraje</span><strong>{selected.mileage?.toLocaleString('es-CR') || '—'} km</strong></article>
              <article><History size={20} /><span>Ingresos al taller</span><strong>{orders.length}</strong></article>
            </div>

            {loadingDetail ? <div className="empty">Cargando expediente...</div> : (
              <>
                <section className="record-section oil-overview">
                  <div className="record-title">
                    <div><Droplets size={22} /><div><h3>Control de aceite</h3><p>Historial y próximo cambio</p></div></div>
                    <button className="primary compact" type="button" onClick={() => setShowOilForm(!showOilForm)}>
                      <Plus size={17} />Registrar cambio
                    </button>
                  </div>

                  {lastOilChange ? (
                    <div className="oil-summary">
                      <div><span>Último cambio</span><strong>{formatDate(lastOilChange.change_date)}</strong></div>
                      <div><span>Kilometraje</span><strong>{lastOilChange.mileage.toLocaleString('es-CR')} km</strong></div>
                      <div><span>Próximo</span><strong>{lastOilChange.next_change_mileage ? `${lastOilChange.next_change_mileage.toLocaleString('es-CR')} km` : formatDate(lastOilChange.next_change_date)}</strong></div>
                    </div>
                  ) : <div className="empty compact-empty">Todavía no hay cambios de aceite registrados.</div>}

                  {showOilForm && (
                    <form className="oil-form" onSubmit={saveOilChange}>
                      <label>Fecha<input required type="date" value={oilForm.change_date} onChange={event => setOilForm({ ...oilForm, change_date: event.target.value })} /></label>
                      <label>Kilometraje<input required type="number" min="0" value={oilForm.mileage} onChange={event => setOilForm({ ...oilForm, mileage: event.target.value })} /></label>
                      <label>Marca del aceite<input value={oilForm.oil_brand} onChange={event => setOilForm({ ...oilForm, oil_brand: event.target.value })} /></label>
                      <label>Viscosidad<input placeholder="Ejemplo: 10W-40" value={oilForm.oil_viscosity} onChange={event => setOilForm({ ...oilForm, oil_viscosity: event.target.value })} /></label>
                      <label>Cantidad (ml)<input type="number" min="1" value={oilForm.quantity_ml} onChange={event => setOilForm({ ...oilForm, quantity_ml: event.target.value })} /></label>
                      <label>Próximo cambio (km)<input type="number" min={oilForm.mileage || 0} value={oilForm.next_change_mileage} onChange={event => setOilForm({ ...oilForm, next_change_mileage: event.target.value })} /></label>
                      <label>Próximo cambio (fecha)<input type="date" value={oilForm.next_change_date} onChange={event => setOilForm({ ...oilForm, next_change_date: event.target.value })} /></label>
                      <label className="check-card"><input type="checkbox" checked={oilForm.filter_changed} onChange={event => setOilForm({ ...oilForm, filter_changed: event.target.checked })} />Filtro de aceite cambiado</label>
                      <label className="wide">Observaciones<textarea value={oilForm.notes} onChange={event => setOilForm({ ...oilForm, notes: event.target.value })} /></label>
                      <button className="primary" disabled={savingOil}>{savingOil ? 'Guardando...' : 'Guardar cambio de aceite'}</button>
                    </form>
                  )}

                  {!!oilChanges.length && (
                    <div className="oil-history">
                      {oilChanges.map(change => (
                        <article key={change.id}>
                          <Droplets size={18} />
                          <div><strong>{formatDate(change.change_date)} · {change.mileage.toLocaleString('es-CR')} km</strong><span>{[change.oil_brand, change.oil_viscosity, change.quantity_ml ? `${change.quantity_ml} ml` : null].filter(Boolean).join(' · ') || 'Aceite sin especificar'}</span></div>
                          <small>Filtro: {change.filter_changed ? 'Sí' : 'No'}</small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="record-section maintenance-overview">
                  <div className="record-title">
                    <div><Wrench size={22} /><div><h3>Historial de mantenimiento</h3><p>Servicios, repuestos y próximos trabajos</p></div></div>
                    <button className="primary compact" type="button" onClick={() => setShowMaintenanceForm(!showMaintenanceForm)}>
                      <Plus size={17} />Registrar servicio
                    </button>
                  </div>

                  {!!latestMaintenance.length && (
                    <div className="maintenance-next-grid">
                      {latestMaintenance.filter(item => item.next_service_date || item.next_service_mileage).map(item => (
                        <article className={maintenanceDue(item) === 'Vencido' ? 'overdue' : ''} key={item.id}>
                          <span>{item.service_type}</span>
                          <strong>{maintenanceDue(item)}</strong>
                        </article>
                      ))}
                    </div>
                  )}

                  {showMaintenanceForm && (
                    <form className="maintenance-form" onSubmit={saveMaintenance}>
                      <label>Tipo de servicio<select required value={maintenanceForm.service_type} onChange={event => setMaintenanceForm({ ...maintenanceForm, service_type: event.target.value })}><option value="">Seleccionar…</option>{serviceTypes.map(item => <option key={item}>{item}</option>)}</select></label>
                      <label>Fecha<input required type="date" value={maintenanceForm.service_date} onChange={event => setMaintenanceForm({ ...maintenanceForm, service_date: event.target.value })} /></label>
                      <label>Kilometraje<input type="number" min="0" value={maintenanceForm.mileage} onChange={event => setMaintenanceForm({ ...maintenanceForm, mileage: event.target.value })} /></label>
                      <label>Orden de trabajo<select value={maintenanceForm.work_order_id} onChange={event => setMaintenanceForm({ ...maintenanceForm, work_order_id: event.target.value })}><option value="">Sin vincular</option>{orders.map(order => <option value={order.id} key={order.id}>{order.order_number}</option>)}</select></label>
                      <label>Técnico<input value={maintenanceForm.technician_name} onChange={event => setMaintenanceForm({ ...maintenanceForm, technician_name: event.target.value })} /></label>
                      <label>Próximo servicio (km)<input type="number" min={maintenanceForm.mileage || 0} value={maintenanceForm.next_service_mileage} onChange={event => setMaintenanceForm({ ...maintenanceForm, next_service_mileage: event.target.value })} /></label>
                      <label>Próximo servicio (fecha)<input type="date" value={maintenanceForm.next_service_date} onChange={event => setMaintenanceForm({ ...maintenanceForm, next_service_date: event.target.value })} /></label>
                      <label className="wide">Trabajo realizado<textarea required rows="3" value={maintenanceForm.details} onChange={event => setMaintenanceForm({ ...maintenanceForm, details: event.target.value })} /></label>
                      <label className="wide">Repuestos o materiales utilizados<textarea rows="2" value={maintenanceForm.parts_used} onChange={event => setMaintenanceForm({ ...maintenanceForm, parts_used: event.target.value })} /></label>
                      <button className="primary" disabled={savingMaintenance}>{savingMaintenance ? 'Guardando…' : 'Guardar mantenimiento'}</button>
                    </form>
                  )}

                  {maintenanceRecords.length ? (
                    <div className="maintenance-history">
                      {maintenanceRecords.map(record => (
                        <article key={record.id}>
                          <Wrench size={18} />
                          <div><strong>{record.service_type}</strong><span>{formatDate(record.service_date)} · {record.mileage?.toLocaleString('es-CR') || '—'} km</span><p>{record.details || 'Sin detalle.'}</p>{record.parts_used && <small>Materiales: {record.parts_used}</small>}</div>
                          <b className={maintenanceDue(record) === 'Vencido' ? 'overdue-text' : ''}>{maintenanceDue(record)}</b>
                        </article>
                      ))}
                    </div>
                  ) : <div className="empty compact-empty">Todavía no hay mantenimientos generales registrados.</div>}
                </section>

                <section className="record-section">
                  <div className="record-title"><div><Bike size={22} /><div><h3>Historial del taller</h3><p>Órdenes de trabajo de esta motocicleta</p></div></div></div>
                  {orders.length ? (
                    <div className="motorcycle-order-history">
                      {orders.map(order => (
                        <article key={order.id}>
                          <div><strong>{order.order_number}</strong><span>{new Date(order.received_at).toLocaleDateString('es-CR')} · {order.mileage ?? '—'} km</span></div>
                          <span className="pill">{order.status}</span>
                          <p>{order.intake_notes || 'Sin motivo registrado.'}</p>
                        </article>
                      ))}
                    </div>
                  ) : <div className="empty compact-empty">Esta motocicleta todavía no tiene órdenes de trabajo.</div>}
                </section>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
