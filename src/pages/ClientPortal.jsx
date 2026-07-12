import { useEffect, useState } from 'react'
import { Bike, CalendarDays, FileText, LogOut, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'

const money = value => new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(Number(value) || 0)
const date = value => value ? new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : '—'

export default function ClientPortal({ workshopSlug }) {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [needsClaim, setNeedsClaim] = useState(false)
  const [message, setMessage] = useState('')
  const [linkSent, setLinkSent] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: result, error }) => {
      if (error) setMessage(error.message)
      setSession(result?.session || null)
      setLoading(false)
    }).catch(error => {
      setMessage(error.message)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setData(null); return }
    loadPortal()
  }, [session?.user?.id])

  async function loadPortal() {
    setLoading(true)
    const [portalResult, maintenanceResult] = await Promise.all([
      supabase.rpc('get_client_portal_data', { p_workshop_slug: workshopSlug }),
      supabase.rpc('get_client_maintenance', { p_workshop_slug: workshopSlug })
    ])
    const { data: portalData, error } = portalResult
    if (error || !portalData?.customer) {
      setData(null)
      setNeedsClaim(true)
    } else {
      setData({
        ...portalData,
        motorcycles: portalData.motorcycles || [],
        work_orders: portalData.work_orders || [],
        oil_changes: portalData.oil_changes || [],
        quotes: portalData.quotes || [],
        invoices: portalData.invoices || [],
        appointments: portalData.appointments || [],
        maintenance: maintenanceResult.error ? [] : maintenanceResult.data || []
      })
      setNeedsClaim(false)
    }
    setLoading(false)
  }

  async function sendLink(event) {
    event.preventDefault(); setSending(true); setMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true }
    })
    setSending(false)
    if (error) setMessage(error.message)
    else setLinkSent(true)
  }

  async function verifyCode(event) {
    event.preventDefault()
    setSending(true)
    setMessage('')
    const { data: result, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: verificationCode.trim(),
      type: 'email'
    })
    setSending(false)
    if (error) {
      setMessage('El código no es válido o ya venció. Solicita uno nuevo.')
      return
    }
    setSession(result.session)
    setLinkSent(false)
  }

  async function claim(event) {
    event.preventDefault(); setSending(true); setMessage('')
    const { error } = await supabase.rpc('claim_customer_portal', { p_workshop_slug: workshopSlug, p_phone: phone })
    setSending(false)
    if (error) setMessage(error.message)
    else loadPortal()
  }

  if (loading) return <main className="public-shell"><section className="public-card">Cargando tu expediente…</section></main>

  if (!session) return (
    <main className="public-shell"><section className="public-card portal-login">
      <div className="public-logo">HCM</div><span className="eyebrow">PORTAL DEL CLIENTE</span><h1>Consulta tu motocicleta</h1>
      <p>Te enviaremos un código seguro a tu correo. No necesitas contraseña.</p>
      {linkSent ? (
        <form onSubmit={verifyCode}>
          <div className="portal-notice"><strong>Revisa tu correo</strong><span>Escribe aquí el código enviado a {email}. No abras otro enlace.</span></div>
          <label>Código de verificación<input required inputMode="numeric" autoComplete="one-time-code" maxLength="8" placeholder="Código recibido" value={verificationCode} onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))} /></label>
          {message && <div className="alert error">{message}</div>}
          <button className="primary" disabled={sending}>{sending ? 'Verificando…' : 'Ingresar a Mi moto'}</button>
          <button className="secondary" type="button" onClick={() => { setLinkSent(false); setVerificationCode(''); setMessage('') }}>Usar otro correo</button>
        </form>
      ) : <form onSubmit={sendLink}><label>Correo registrado en el taller<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>{message && <div className="alert error">{message}</div>}<button className="primary" disabled={sending}>{sending ? 'Enviando…' : 'Enviar código de acceso'}</button></form>}
      <a href="/reservar">¿Necesitas una cita? Reservar ahora</a>
    </section></main>
  )

  if (needsClaim) return (
    <main className="public-shell"><section className="public-card portal-login">
      <span className="eyebrow">VERIFICACIÓN INICIAL</span><h1>Confirma tu teléfono</h1><p>Escribe el mismo número de WhatsApp que tienes registrado en el taller.</p>
      <form onSubmit={claim}><label>Teléfono o WhatsApp<input required inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>{message && <div className="alert error">{message}</div>}<button className="primary" disabled={sending}>{sending ? 'Verificando…' : 'Abrir mi expediente'}</button></form>
      <button className="secondary" onClick={() => supabase.auth.signOut()}>Usar otro correo</button>
    </section></main>
  )

  if (!data?.customer) return (
    <main className="public-shell"><section className="public-card portal-login">
      <span className="eyebrow">PORTAL DEL CLIENTE</span>
      <h1>No pudimos abrir el expediente</h1>
      <p>Vuelve a verificar tu teléfono o inicia sesión nuevamente.</p>
      <button className="primary" onClick={() => setNeedsClaim(true)}>Verificar teléfono</button>
      <button className="secondary" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </section></main>
  )

  const motorcycleName = id => { const moto = data.motorcycles.find(item => item.id === id); return moto ? `${moto.brand} ${moto.model}` : 'Motocicleta' }
  return (
    <main className="public-shell portal-shell"><section className="public-card portal-dashboard">
      <header className="portal-header"><div><span className="eyebrow">MI TALLER</span><h1>Hola, {data.customer.full_name}</h1><p>{data.workshop.name}</p></div><button className="secondary" onClick={() => supabase.auth.signOut()}><LogOut size={17} /> Salir</button></header>
      <nav className="portal-actions"><a className="primary" href="/reservar"><CalendarDays size={18} /> Reservar cita</a></nav>
      <section><h2><Bike size={21} /> Mis motocicletas</h2><div className="portal-grid">{data.motorcycles.map(moto => <article className="portal-item" key={moto.id}><strong>{moto.brand} {moto.model}</strong><span>{moto.plate || 'Sin placa'} · {moto.mileage ?? '—'} km</span><small>{moto.year || 'Año no registrado'} {moto.color ? `· ${moto.color}` : ''}</small></article>)}</div></section>
      <section><h2><Wrench size={21} /> Órdenes de trabajo</h2><div className="portal-list">{data.work_orders.length ? data.work_orders.map(order => <article key={order.id}><div><strong>{order.order_number}</strong><span>{motorcycleName(order.motorcycle_id)} · {date(order.received_at)}</span><small>{order.reason}</small></div><b className="portal-status">{order.status}</b></article>) : <p className="empty">No hay órdenes registradas.</p>}</div></section>
      <section><h2>Cambios de aceite</h2><div className="portal-list">{data.oil_changes.length ? data.oil_changes.map(change => <article key={change.id}><div><strong>{motorcycleName(change.motorcycle_id)}</strong><span>{date(change.change_date)} · {change.mileage} km</span><small>{change.oil_brand || 'Aceite'} {change.oil_viscosity || ''}</small></div><b>Próximo: {change.next_change_mileage ? `${change.next_change_mileage} km` : date(change.next_change_date)}</b></article>) : <p className="empty">Sin cambios de aceite registrados.</p>}</div></section>
      <section><h2><Wrench size={21} /> Historial de mantenimiento</h2><div className="portal-list">{data.maintenance.length ? data.maintenance.map(item => <article key={item.id}><div><strong>{item.service_type} · {motorcycleName(item.motorcycle_id)}</strong><span>{date(item.service_date)} · {item.mileage ?? '—'} km</span><small>{item.details || 'Servicio registrado'}{item.parts_used ? ` · Materiales: ${item.parts_used}` : ''}</small></div><b>{item.next_service_mileage ? `Próximo: ${item.next_service_mileage} km` : item.next_service_date ? `Próximo: ${date(item.next_service_date)}` : 'Completado'}</b></article>) : <p className="empty">Sin mantenimientos generales registrados.</p>}</div></section>
      <section><h2><FileText size={21} /> Documentos</h2><div className="portal-grid">{data.quotes.map(item => <article className="portal-item" key={item.quote_number}><strong>{item.quote_number}</strong><span>Presupuesto · {item.status}</span><b>{money(item.total)}</b></article>)}{data.invoices.map(item => <article className="portal-item" key={item.invoice_number}><strong>{item.invoice_number}</strong><span>Factura · {item.status}</span><b>{money(item.total)}</b></article>)}{!data.quotes.length && !data.invoices.length && <p className="empty">Sin documentos disponibles.</p>}</div></section>
    </section></main>
  )
}
