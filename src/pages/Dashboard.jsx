import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bike,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Droplets,
  MessageCircle
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const localToday = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)

const dateDiff = date =>
  Math.ceil((new Date(`${date}T23:59:59`) - new Date()) / 86400000)

export default function Dashboard({ userName, workshop }) {
  const [stats, setStats] = useState({
    today: 0,
    bikesInShop: 0,
    waiting: 0,
    ready: 0,
    income: 0
  })
  const [recent, setRecent] = useState([])
  const [oilAlerts, setOilAlerts] = useState([])
  const [maintenanceAlerts, setMaintenanceAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    const [appointmentsResult, ordersResult, oilResult, maintenanceResult] = await Promise.all([
      supabase
        .from('appointments')
        .select('*')
        .order('appointment_date')
        .order('appointment_time'),
      supabase
        .from('work_orders')
        .select('id, status'),
      supabase
        .from('oil_changes')
        .select(`
          *,
          motorcycle:motorcycles(
            id,
            brand,
            model,
            plate,
            mileage,
            customer:customers(full_name, phone)
          )
        `)
        .order('change_date', { ascending: false }),
      supabase
        .from('maintenance_records')
        .select(`
          *,
          motorcycle:motorcycles(
            id, brand, model, plate, mileage,
            customer:customers(full_name, phone)
          )
        `)
        .order('service_date', { ascending: false })
    ])

    if (appointmentsResult.error) alert(appointmentsResult.error.message)
    if (ordersResult.error) alert(ordersResult.error.message)
    if (oilResult.error) alert(oilResult.error.message)
    if (maintenanceResult.error) alert(maintenanceResult.error.message)

    const appointments = appointmentsResult.data || []
    const orders = ordersResult.data || []
    const activeOrders = orders.filter(
      order => !['Entregada', 'Cancelada'].includes(order.status)
    )

    setStats({
      today: appointments.filter(
        appointment =>
          appointment.appointment_date === localToday() &&
          appointment.status !== 'Cancelada'
      ).length,
      bikesInShop: activeOrders.length,
      waiting: orders.filter(
        order => order.status === 'Esperando repuestos'
      ).length,
      ready: orders.filter(
        order => order.status === 'Lista para entregar'
      ).length,
      income: 0
    })

    setRecent(
      appointments
        .filter(appointment => appointment.appointment_date >= localToday())
        .slice(0, 5)
    )

    const latestByMotorcycle = new Map()
    for (const change of oilResult.data || []) {
      if (
        change.motorcycle &&
        !latestByMotorcycle.has(change.motorcycle_id)
      ) {
        latestByMotorcycle.set(change.motorcycle_id, change)
      }
    }

    const alerts = [...latestByMotorcycle.values()]
      .map(change => {
        const currentMileage = change.motorcycle?.mileage
        const mileageRemaining =
          currentMileage !== null && change.next_change_mileage !== null
            ? change.next_change_mileage - currentMileage
            : null
        const daysRemaining = change.next_change_date
          ? dateDiff(change.next_change_date)
          : null
        const overdue =
          (mileageRemaining !== null && mileageRemaining <= 0) ||
          (daysRemaining !== null && daysRemaining < 0)
        const upcoming =
          (mileageRemaining !== null && mileageRemaining > 0 && mileageRemaining <= 500) ||
          (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30)

        if (!overdue && !upcoming) return null

        return {
          ...change,
          level: overdue ? 'overdue' : 'upcoming',
          mileageRemaining,
          daysRemaining
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a.level === 'overdue' ? -1 : 1) - (b.level === 'overdue' ? -1 : 1))

    setOilAlerts(alerts)

    const latestServices = new Map()
    for (const record of maintenanceResult.data || []) {
      const key = `${record.motorcycle_id}:${record.service_type}`
      if (record.motorcycle && !latestServices.has(key)) latestServices.set(key, record)
    }

    setMaintenanceAlerts([...latestServices.values()].map(record => {
      const mileageRemaining = record.next_service_mileage !== null && record.motorcycle?.mileage !== null
        ? record.next_service_mileage - record.motorcycle.mileage
        : null
      const daysRemaining = record.next_service_date ? dateDiff(record.next_service_date) : null
      const overdue = (mileageRemaining !== null && mileageRemaining <= 0) || (daysRemaining !== null && daysRemaining < 0)
      const upcoming = (mileageRemaining !== null && mileageRemaining > 0 && mileageRemaining <= 500) || (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30)
      if (!overdue && !upcoming) return null
      return { ...record, level: overdue ? 'overdue' : 'upcoming', mileageRemaining, daysRemaining }
    }).filter(Boolean))
    setLoading(false)
  }

  function whatsappLink(alert, service = 'cambio de aceite') {
    const phone = String(alert.motorcycle?.customer?.phone || '').replace(/\D/g, '')
    const fullPhone = phone.startsWith('506') ? phone : `506${phone}`
    const motorcycle = `${alert.motorcycle?.brand || ''} ${alert.motorcycle?.model || ''}`.trim()
    const message = encodeURIComponent(
      `Hola ${alert.motorcycle?.customer?.full_name || ''}. Según el historial de su ${motorcycle}, ya se aproxima o corresponde realizar: ${service}. Si gusta, podemos agendarle una cita. Saludos, Herrera Custom Motorcycle.`
    )
    return `https://wa.me/${fullPhone}?text=${message}`
  }

  function alertDetail(alert) {
    const details = []
    if (alert.mileageRemaining !== null) {
      details.push(
        alert.mileageRemaining <= 0
          ? `Vencido por ${Math.abs(alert.mileageRemaining).toLocaleString('es-CR')} km`
          : `Faltan ${alert.mileageRemaining.toLocaleString('es-CR')} km`
      )
    }
    if (alert.daysRemaining !== null) {
      details.push(
        alert.daysRemaining < 0
          ? `Vencido hace ${Math.abs(alert.daysRemaining)} días`
          : `Faltan ${alert.daysRemaining} días`
      )
    }
    return details.join(' · ')
  }

  const cards = [
    ['Citas de hoy', stats.today, CalendarDays],
    ['Motos en el taller', stats.bikesInShop, Bike],
    ['Esperando repuestos', stats.waiting, Clock3],
    ['Listas para entregar', stats.ready, CheckCircle2]
  ]

  return (
    <>
      <section className="dashboard-welcome">
        <span className="eyebrow">{workshop?.name || 'HCM WORKSHOP MANAGER'}</span>
        <h1>Buenos días, {userName || 'equipo'} 👋</h1>
        <p>Aquí tienes el resumen de lo que está pasando hoy en el taller.</p>
      </section>

      <div className="stats-grid">
        {cards.map(([title, value, Icon]) => (
          <article className="stat-card" key={title}>
            <div><span>{title}</span><strong>{loading ? '—' : value}</strong></div>
            <Icon />
          </article>
        ))}
      </div>

      <section className="panel maintenance-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">MANTENIMIENTO PREVENTIVO</span>
            <h2>Alertas de mantenimiento</h2>
            <p className="muted">Aceite y servicios generales próximos en 500 km o 30 días.</p>
          </div>
          <button className="secondary" type="button" onClick={load}>Actualizar</button>
        </div>

        {loading ? (
          <div className="empty">Revisando mantenimientos...</div>
        ) : oilAlerts.length || maintenanceAlerts.length ? (
          <div className="maintenance-alert-list">
            {oilAlerts.map(alert => (
              <article className={`maintenance-alert ${alert.level}`} key={alert.id}>
                <div className="maintenance-alert-icon">
                  {alert.level === 'overdue' ? <AlertTriangle size={22} /> : <Droplets size={22} />}
                </div>
                <div>
                  <span>{alert.level === 'overdue' ? 'CAMBIO VENCIDO' : 'CAMBIO PRÓXIMO'}</span>
                  <strong>{alert.motorcycle.brand} {alert.motorcycle.model}</strong>
                  <small>
                    {alert.motorcycle.customer?.full_name || 'Sin propietario'} · {alert.motorcycle.plate || 'Sin placa'}
                    <br />{alertDetail(alert)}
                  </small>
                </div>
                {alert.motorcycle.customer?.phone && (
                  <a href={whatsappLink(alert)} target="_blank" rel="noreferrer" title="Avisar por WhatsApp">
                    <MessageCircle size={19} />
                  </a>
                )}
              </article>
            ))}
            {maintenanceAlerts.map(alert => (
              <article className={`maintenance-alert ${alert.level}`} key={alert.id}>
                <div className="maintenance-alert-icon"><AlertTriangle size={22} /></div>
                <div>
                  <span>{alert.level === 'overdue' ? 'SERVICIO VENCIDO' : 'SERVICIO PRÓXIMO'}</span>
                  <strong>{alert.service_type} · {alert.motorcycle.brand} {alert.motorcycle.model}</strong>
                  <small>{alert.motorcycle.customer?.full_name || 'Sin propietario'} · {alert.motorcycle.plate || 'Sin placa'}<br />{alertDetail(alert)}</small>
                </div>
                {alert.motorcycle.customer?.phone && <a href={whatsappLink(alert, alert.service_type)} target="_blank" rel="noreferrer"><MessageCircle size={19} /></a>}
              </article>
            ))}
          </div>
        ) : (
          <div className="maintenance-clear">
            <CheckCircle2 size={30} />
            <div><strong>Mantenimientos al día</strong><span>No hay servicios próximos o vencidos.</span></div>
          </div>
        )}
      </section>

      <section className="panel dashboard-agenda-panel">
        <div className="panel-title">
          <div><span className="eyebrow">PRÓXIMOS TRABAJOS</span><h2>Agenda próxima</h2></div>
        </div>

        {recent.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Moto</th><th>Servicio</th><th>Estado</th></tr></thead>
              <tbody>
                {recent.map(appointment => (
                  <tr key={appointment.id}>
                    <td>{appointment.appointment_date}</td>
                    <td>{String(appointment.appointment_time).slice(0, 5)}</td>
                    <td>{appointment.customer_name}</td>
                    <td>{appointment.brand} {appointment.model}</td>
                    <td>{appointment.service}</td>
                    <td><span className={`pill ${appointment.status.toLowerCase()}`}>{appointment.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No hay citas próximas.</div>}
      </section>
    </>
  )
}
