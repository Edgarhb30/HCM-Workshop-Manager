import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Bike,
  Clock3,
  CircleDollarSign,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)

export default function Dashboard() {
  const [stats, setStats] = useState({
    today: 0,
    bikes: 0,
    waiting: 0,
    income: 0,
  })

  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const [appointmentsResult, motorcyclesResult] = await Promise.all([
      supabase
        .from('appointments')
        .select('*')
        .order('appointment_date')
        .order('appointment_time'),

      supabase
        .from('motorcycles')
        .select('id', { count: 'exact', head: true }),
    ])

    const appointments = appointmentsResult.data || []

    setStats({
      today: appointments.filter(
        appointment =>
          appointment.appointment_date === today() &&
          appointment.status !== 'Cancelada'
      ).length,

      bikes: motorcyclesResult.count || 0,
      waiting: 0,
      income: 0,
    })

    setRecent(
      appointments
        .filter(appointment => appointment.appointment_date >= today())
        .slice(0, 5)
    )

    setLoading(false)
  }

  const cards = [
    {
      title: 'Citas de hoy',
      value: stats.today,
      icon: CalendarDays,
    },
    {
      title: 'Motocicletas registradas',
      value: stats.bikes,
      icon: Bike,
    },
    {
      title: 'Esperando repuestos',
      value: stats.waiting,
      icon: Clock3,
    },
    {
      title: 'Ingresos del día',
      value: `₡${stats.income.toLocaleString('es-CR')}`,
      icon: CircleDollarSign,
    },
  ]

  return (
    <>
      <section className="dashboard-welcome">
        <span className="eyebrow">HERRERA CUSTOM MOTORCYCLE</span>
        <h1>Buenos días, Edgar 👋</h1>
        <p>
          Aquí tienes el resumen de lo que está pasando hoy en el taller.
        </p>
      </section>

      <div className="stats-grid">
        {cards.map(card => {
          const Icon = card.icon

          return (
            <article className="stat-card" key={card.title}>
              <div>
                <span>{card.title}</span>
                <strong>{loading ? '—' : card.value}</strong>
              </div>

              <Icon />
            </article>
          )
        })}
      </div>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">PRÓXIMOS TRABAJOS</span>
            <h2>Agenda próxima</h2>
          </div>

          <button className="secondary" onClick={load}>
            Actualizar
          </button>
        </div>

        {recent.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Moto</th>
                  <th>Servicio</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {recent.map(appointment => (
                  <tr key={appointment.id}>
                    <td>{appointment.appointment_date}</td>
                    <td>
                      {String(appointment.appointment_time).slice(0, 5)}
                    </td>
                    <td>{appointment.customer_name}</td>
                    <td>
                      {appointment.brand} {appointment.model}
                    </td>
                    <td>{appointment.service}</td>
                    <td>
                      <span
                        className={`pill ${appointment.status.toLowerCase()}`}
                      >
                        {appointment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No hay citas próximas.</div>
        )}
      </section>
    </>
  )
}