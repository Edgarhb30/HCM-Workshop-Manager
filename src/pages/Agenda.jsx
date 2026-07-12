import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  MessageCircle,
  Search,
  Wrench
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const statuses = ['Pendiente', 'Confirmada', 'Cancelada', 'Completada']

export default function Agenda({ onReceive }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todas')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('appointment_date')
      .order('appointment_time')

    if (error) alert(error.message)
    setRows(data || [])
    setLoading(false)
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
        <button className="secondary" type="button" onClick={load}>Actualizar</button>
      </div>

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
                <select value={appointment.status} onChange={event => updateStatus(appointment.id, event.target.value)}>
                  {statuses.map(status => <option key={status}>{status}</option>)}
                </select>
                <a className="icon-action whatsapp" href={whatsappLink(appointment)} target="_blank" rel="noreferrer" title="Contactar por WhatsApp">
                  <MessageCircle size={18} />
                </a>
                {!['Cancelada', 'Completada'].includes(appointment.status) && (
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
