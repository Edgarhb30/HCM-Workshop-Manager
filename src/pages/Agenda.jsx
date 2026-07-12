import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Wrench
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const statuses = ['Pendiente', 'Confirmada', 'Cancelada', 'Completada']
const localDate = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

function viewRange(view, reference) {
  const date = new Date(`${reference}T12:00:00`)
  if (view === 'list') return null
  if (view === 'today') return [reference, reference]
  if (view === 'week') {
    const start = new Date(date)
    start.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return [localDate(start), localDate(end)]
  }
  return [localDate(new Date(date.getFullYear(), date.getMonth(), 1)), localDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))]
}

export default function Agenda({ onReceive, role }) {
  const canManage = ['owner', 'admin', 'reception'].includes(role)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [view, setView] = useState('today')
  const [referenceDate, setReferenceDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [blocks, setBlocks] = useState([])
  const [services, setServices] = useState([])
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [reprogramForm, setReprogramForm] = useState({ service_id: '', date: '', time: '' })
  const [reprogramming, setReprogramming] = useState(false)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockForm, setBlockForm] = useState({ block_date: '', all_day: true, start_time: '12:00', end_time: '13:00', reason: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [appointmentsResult, blocksResult, servicesResult] = await Promise.all([
      supabase.from('appointments').select('*').order('appointment_date').order('appointment_time'),
      supabase.from('schedule_blocks').select('*').gte('block_date', new Date().toLocaleDateString('en-CA')).order('block_date').order('start_time'),
      supabase.from('appointment_services').select('*').eq('active', true).order('name')
    ])
    const { data, error } = appointmentsResult

    if (error) alert(error.message)
    setRows(data || [])
    if (blocksResult.error) alert(blocksResult.error.message)
    else setBlocks(blocksResult.data || [])
    if (servicesResult.error) alert(servicesResult.error.message)
    else setServices(servicesResult.data || [])
    setLoading(false)
  }

  function startReprogramming(appointment) {
    setEditingAppointment(appointment.id)
    setReprogramForm({
      service_id: appointment.service_id || services.find(service => service.name === appointment.service)?.id || '',
      date: appointment.appointment_date,
      time: String(appointment.appointment_time).slice(0, 5)
    })
  }

  async function reprogram(event, appointment) {
    event.preventDefault()
    setReprogramming(true)
    const { error } = await supabase.rpc('reprogram_appointment', {
      p_appointment_id: appointment.id,
      p_service_id: reprogramForm.service_id,
      p_date: reprogramForm.date,
      p_time: reprogramForm.time
    })
    setReprogramming(false)
    if (error) return alert(`No se pudo reprogramar: ${error.message}`)
    setEditingAppointment(null)
    load()
  }

  async function saveBlock(event) {
    event.preventDefault()
    const { error } = await supabase.from('schedule_blocks').insert({
      block_date: blockForm.block_date,
      all_day: blockForm.all_day,
      start_time: blockForm.all_day ? null : blockForm.start_time,
      end_time: blockForm.all_day ? null : blockForm.end_time,
      reason: blockForm.reason.trim() || null
    })
    if (error) return alert(`No se pudo bloquear el horario: ${error.message}`)
    setBlockForm({ block_date: '', all_day: true, start_time: '12:00', end_time: '13:00', reason: '' })
    setShowBlockForm(false)
    load()
  }

  async function deleteBlock(id) {
    if (!confirm('¿Liberar nuevamente este horario?')) return
    const { error } = await supabase.from('schedule_blocks').delete().eq('id', id)
    if (error) return alert(error.message)
    setBlocks(current => current.filter(block => block.id !== id))
  }

  async function updateStatus(id, value) {
    const { error } = await supabase
      .from('appointments')
      .update({ status: value })
      .eq('id', id)

    if (error) return alert(error.message)
    setRows(current =>
      current.map(appointment =>
        appointment.id === id
          ? { ...appointment, status: value }
          : appointment
      )
    )
  }

  function whatsappLink(appointment) {
    const phone = String(appointment.phone || '').replace(/\D/g, '')
    const fullPhone = phone.startsWith('506') ? phone : `506${phone}`
    const message = encodeURIComponent(
      `Hola ${appointment.customer_name}. Le escribimos de Herrera Custom Motorcycle sobre su cita del ${appointment.appointment_date} a las ${String(appointment.appointment_time).slice(0, 5)}.`
    )
    return `https://wa.me/${fullPhone}?text=${message}`
  }

  const filteredRows = useMemo(() => {
    const term = search.toLowerCase().trim()
    const range = viewRange(view, referenceDate)
    return rows.filter(appointment => {
      const matchesStatus =
        statusFilter === 'Todas' || appointment.status === statusFilter
      const text = [
        appointment.customer_name,
        appointment.phone,
        appointment.brand,
        appointment.model,
        appointment.plate,
        appointment.service
      ].filter(Boolean).join(' ').toLowerCase()
      const matchesRange = !range || (appointment.appointment_date >= range[0] && appointment.appointment_date <= range[1])
      return matchesStatus && matchesRange && text.includes(term)
    })
  }, [rows, search, statusFilter, view, referenceDate])

  function navigate(direction) {
    const date = new Date(`${referenceDate}T12:00:00`)
    if (view === 'today') date.setDate(date.getDate() + direction)
    if (view === 'week') date.setDate(date.getDate() + direction * 7)
    if (view === 'month') date.setMonth(date.getMonth() + direction)
    setReferenceDate(localDate(date))
  }

  const range = viewRange(view, referenceDate)
  const rangeLabel = view === 'list' ? 'Todas las fechas' : view === 'today'
    ? new Date(`${referenceDate}T12:00:00`).toLocaleDateString('es-CR', { dateStyle: 'full' })
    : `${new Date(`${range[0]}T12:00:00`).toLocaleDateString('es-CR', { dateStyle: 'medium' })} — ${new Date(`${range[1]}T12:00:00`).toLocaleDateString('es-CR', { dateStyle: 'medium' })}`

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">AGENDA</span>
          <h2>Todas las citas</h2>
          <p className="muted">Confirma, contacta o lleva una cita directamente a recepción.</p>
        </div>
        <div className="agenda-heading-actions">
          {canManage && <button className="primary compact" type="button" onClick={() => setShowBlockForm(!showBlockForm)}><Plus size={17} />Bloquear horario</button>}
          <button className="secondary" type="button" onClick={load}>Actualizar</button>
        </div>
      </div>

      {canManage && showBlockForm && <form className="schedule-block-form" onSubmit={saveBlock}>
        <label>Fecha<input required type="date" min={new Date().toLocaleDateString('en-CA')} value={blockForm.block_date} onChange={event => setBlockForm({ ...blockForm, block_date: event.target.value })} /></label>
        <label className="block-all-day"><input type="checkbox" checked={blockForm.all_day} onChange={event => setBlockForm({ ...blockForm, all_day: event.target.checked })} />Bloquear todo el día</label>
        {!blockForm.all_day && <><label>Desde<input required type="time" value={blockForm.start_time} onChange={event => setBlockForm({ ...blockForm, start_time: event.target.value })} /></label><label>Hasta<input required type="time" value={blockForm.end_time} onChange={event => setBlockForm({ ...blockForm, end_time: event.target.value })} /></label></>}
        <label className="wide">Motivo<input placeholder="Feriado, vacaciones, almuerzo…" value={blockForm.reason} onChange={event => setBlockForm({ ...blockForm, reason: event.target.value })} /></label>
        <button className="primary">Guardar bloqueo</button>
      </form>}

      {!!blocks.length && <section className="upcoming-blocks"><h3>Próximos bloqueos</h3><div>{blocks.map(block => <article key={block.id}><CalendarDays size={18} /><span><strong>{block.block_date}</strong><small>{block.all_day ? 'Todo el día' : `${String(block.start_time).slice(0,5)} a ${String(block.end_time).slice(0,5)}`} · {block.reason || 'Sin motivo'}</small></span>{canManage && <button className="icon" type="button" title="Liberar horario" onClick={() => deleteBlock(block.id)}><Trash2 size={17} /></button>}</article>)}</div></section>}

      <div className="agenda-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="search"
            placeholder="Buscar cliente, teléfono, moto, placa o servicio"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
          <option>Todas</option>
          {statuses.map(status => <option key={status}>{status}</option>)}
        </select>
        <strong>{filteredRows.length} citas</strong>
      </div>

      <div className="agenda-viewbar">
        <div className="agenda-view-buttons">
          {[['today','Hoy'],['week','Semana'],['month','Mes'],['list','Lista']].map(([id, label]) => <button className={view === id ? 'active' : ''} type="button" key={id} onClick={() => setView(id)}>{label}</button>)}
        </div>
        <div className="agenda-date-navigation">
          {view !== 'list' && <button className="icon" type="button" onClick={() => navigate(-1)}><ChevronLeft size={18} /></button>}
          <strong>{rangeLabel}</strong>
          {view !== 'list' && <button className="icon" type="button" onClick={() => navigate(1)}><ChevronRight size={18} /></button>}
          {view !== 'list' && referenceDate !== new Date().toLocaleDateString('en-CA') && <button className="secondary compact" type="button" onClick={() => setReferenceDate(new Date().toLocaleDateString('en-CA'))}>Volver a hoy</button>}
        </div>
      </div>

      {loading ? <div className="empty">Cargando citas...</div> : (
        <div className="cards-list">
          {filteredRows.map(appointment => (
            <article className="appointment-card agenda-card" key={appointment.id}>
              <div className="appointment-date-box">
                <CalendarDays size={20} />
                <strong>{appointment.appointment_date}</strong>
                <span>{String(appointment.appointment_time).slice(0, 5)}</span>
              </div>

              <div className="appointment-main">
                <h3>{appointment.customer_name}</h3>
                <p>{appointment.brand} {appointment.model} · {appointment.service}</p>
                <small>{appointment.phone}{appointment.customer_notes ? ` · ${appointment.customer_notes}` : ''}</small>
              </div>

              <div className="appointment-actions agenda-actions">
                <span className={`pill ${appointment.status.toLowerCase()}`}>{appointment.status}</span>
                <select value={appointment.status} disabled={!canManage} onChange={event => updateStatus(appointment.id, event.target.value)}>
                  {statuses.map(status => <option key={status}>{status}</option>)}
                </select>
                <a className="icon-action whatsapp" href={whatsappLink(appointment)} target="_blank" rel="noreferrer" title="Contactar por WhatsApp">
                  <MessageCircle size={18} />
                </a>
                {canManage && !['Cancelada', 'Completada'].includes(appointment.status) && (
                  <button className="primary compact" type="button" onClick={() => onReceive(appointment)}>
                    <Wrench size={17} />Recibir moto
                  </button>
                )}
                {canManage && appointment.status !== 'Completada' && <button className="secondary compact" type="button" onClick={() => startReprogramming(appointment)}><CalendarClock size={17} />Reprogramar</button>}
              </div>
              {editingAppointment === appointment.id && <form className="reprogram-form" onSubmit={event => reprogram(event, appointment)}>
                <label>Servicio<select required value={reprogramForm.service_id} onChange={event => setReprogramForm({ ...reprogramForm, service_id: event.target.value })}><option value="">Seleccionar</option>{services.map(service => <option value={service.id} key={service.id}>{service.name} · {service.duration_minutes} min</option>)}</select></label>
                <label>Nueva fecha<input required type="date" min={new Date().toLocaleDateString('en-CA')} value={reprogramForm.date} onChange={event => setReprogramForm({ ...reprogramForm, date: event.target.value })} /></label>
                <label>Nueva hora<input required type="time" value={reprogramForm.time} onChange={event => setReprogramForm({ ...reprogramForm, time: event.target.value })} /></label>
                <button className="primary compact" disabled={reprogramming}>{reprogramming ? 'Comprobando…' : 'Guardar nueva cita'}</button>
                <button className="secondary compact" type="button" onClick={() => setEditingAppointment(null)}>Cancelar</button>
              </form>}
            </article>
          ))}
        </div>
      )}

      {!loading && !filteredRows.length && <div className="empty">No hay citas que coincidan con la búsqueda.</div>}
    </section>
  )
}
