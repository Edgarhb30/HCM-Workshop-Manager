import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Wrench
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const statuses = ['Pendiente', 'Confirmada', 'Cancelada', 'Completada']

export default function Agenda({ onReceive, role }) {
  const canManage = ['owner', 'admin', 'reception'].includes(role)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [blocks, setBlocks] = useState([])
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockForm, setBlockForm] = useState({ block_date: '', all_day: true, start_time: '12:00', end_time: '13:00', reason: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [appointmentsResult, blocksResult] = await Promise.all([
      supabase.from('appointments').select('*').order('appointment_date').order('appointment_time'),
      supabase.from('schedule_blocks').select('*').gte('block_date', new Date().toLocaleDateString('en-CA')).order('block_date').order('start_time')
    ])
    const { data, error } = appointmentsResult

    if (error) alert(error.message)
    setRows(data || [])
    if (blocksResult.error) alert(blocksResult.error.message)
    else setBlocks(blocksResult.data || [])
    setLoading(false)
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
      return matchesStatus && text.includes(term)
    })
  }, [rows, search, statusFilter])

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
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !filteredRows.length && <div className="empty">No hay citas que coincidan con la búsqueda.</div>}
    </section>
  )
}
