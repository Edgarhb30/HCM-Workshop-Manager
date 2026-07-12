import { useEffect, useState } from 'react'
import { Bike, CalendarDays, CheckCircle2, Clock3, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { defaultBranding, themeVariables } from '../lib/theme'

const initialForm = {
  customer_name: '', phone: '', email: '', brand: '', model: '',
  motorcycle_year: '', plate: '', service_id: '', date: '', time: '', notes: ''
}

function timeLabel(value) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number)
  const suffix = hour >= 12 ? 'p. m.' : 'a. m.'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
}

export default function PublicBooking({ workshopSlug }) {
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const publicTheme = { ...defaultBranding, ...(config || {}) }
  const shellProps = {
    className: `public-shell themed-public theme-${publicTheme.theme_mode}`,
    style: themeVariables(publicTheme)
  }

  useEffect(() => {
    Promise.all([
      supabase.rpc('get_public_workshop_config', { p_workshop_slug: workshopSlug }),
      supabase.rpc('get_public_booking_config', { p_workshop_slug: workshopSlug })
    ]).then(([brandingResult, bookingResult]) => {
        const error = bookingResult.error || brandingResult.error
        if (error) setMessage(error.message)
        else setConfig({ ...(brandingResult.data || {}), ...(bookingResult.data || {}) })
        setLoading(false)
      })
  }, [workshopSlug])

  useEffect(() => {
    if (!form.date || !form.service_id) {
      setSlots([])
      return
    }
    setForm(current => ({ ...current, time: '' }))
    setLoadingSlots(true)
    supabase.rpc('get_public_available_slots', {
      p_workshop_slug: workshopSlug,
      p_date: form.date,
      p_service_id: form.service_id
    }).then(({ data, error }) => {
      if (error) setMessage(error.message)
      setSlots((data || []).map(item => item.appointment_time.slice(0, 5)))
      setLoadingSlots(false)
    })
  }, [form.date, form.service_id, workshopSlug])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const { error } = await supabase.rpc('create_public_appointment_v2', {
      p_workshop_slug: workshopSlug,
      p_customer_name: form.customer_name,
      p_phone: form.phone,
      p_email: form.email,
      p_brand: form.brand,
      p_model: form.model,
      p_motorcycle_year: form.motorcycle_year ? Number(form.motorcycle_year) : null,
      p_plate: form.plate,
      p_service_id: form.service_id,
      p_date: form.date,
      p_time: form.time,
      p_customer_notes: form.notes
    })
    setSaving(false)
    if (error) {
      setMessage(error.message.includes('duplicate') ? 'Ese horario acaba de ser reservado. Selecciona otro.' : error.message)
      return
    }
    setSuccess(true)
  }

  const minimumDate = new Date().toLocaleDateString('en-CA')
  const maximumDate = new Date(Date.now() + (Number(config?.maximum_booking_days) || 60) * 86400000).toLocaleDateString('en-CA')

  if (loading) return <div {...shellProps}><div className="public-card">Cargando agenda…</div></div>

  if (success) return (
    <main {...shellProps}>
      <section className="public-card public-success">
        <CheckCircle2 size={58} />
        <span className="eyebrow">SOLICITUD RECIBIDA</span>
        <h1>Tu cita fue registrada</h1>
        <p>{config?.manual_confirmation ? 'El taller revisará la solicitud y te confirmará por WhatsApp.' : 'Tu espacio quedó reservado.'}</p>
        <strong>{form.date} · {timeLabel(form.time)}</strong>
        <button className="primary" onClick={() => { setForm(initialForm); setSuccess(false) }}>Solicitar otra cita</button>
        <a href="/mi-moto">Consultar el historial de mi moto</a>
      </section>
    </main>
  )

  return (
    <main {...shellProps}>
      <section className="public-card public-booking">
        <header className="public-brand">
          <div className="public-logo">HCM</div>
          <div><span className="eyebrow">AGENDA EN LÍNEA</span><h1>{config?.name || 'Herrera Custom Motorcycle'}</h1><p>Solicita tu espacio en el taller.</p></div>
        </header>
        {!config?.public_booking_enabled ? <div className="alert error">Las reservas públicas están desactivadas.</div> : (
          <form className="public-form" onSubmit={submit}>
            <h2><span><Bike size={21} /> Tus datos</span></h2>
            <label>Nombre completo<input required value={form.customer_name} onChange={e => update('customer_name', e.target.value)} /></label>
            <label>WhatsApp<input required inputMode="tel" value={form.phone} onChange={e => update('phone', e.target.value)} /></label>
            <label>Correo (opcional)<input type="email" value={form.email} onChange={e => update('email', e.target.value)} /></label>
            <h2><span><Wrench size={21} /> Motocicleta y servicio</span></h2>
            <label>Marca<input required value={form.brand} onChange={e => update('brand', e.target.value)} /></label>
            <label>Modelo<input required value={form.model} onChange={e => update('model', e.target.value)} /></label>
            <label>Año<input type="number" min="1950" max="2035" value={form.motorcycle_year} onChange={e => update('motorcycle_year', e.target.value)} /></label>
            <label>Placa (opcional)<input value={form.plate} onChange={e => update('plate', e.target.value)} /></label>
            <label className="wide">Servicio solicitado<select required value={form.service_id} onChange={e => update('service_id', e.target.value)}><option value="">Selecciona…</option>{(config?.services || []).map(service => <option value={service.id} key={service.id}>{service.name} · espacio reservado: {service.duration_minutes} min</option>)}</select></label>
            <h2><span><CalendarDays size={21} /> Fecha y hora</span></h2>
            <label>Fecha<input required type="date" min={minimumDate} max={maximumDate} disabled={!form.service_id} value={form.date} onChange={e => update('date', e.target.value)} /></label>
            <label>Hora<select required disabled={!form.date || loadingSlots || !slots.length} value={form.time} onChange={e => update('time', e.target.value)}><option value="">{!form.service_id ? 'Primero selecciona servicio' : !form.date ? 'Selecciona la fecha' : loadingSlots ? 'Buscando espacios…' : slots.length ? 'Selecciona…' : 'No hay espacios disponibles'}</option>{slots.map(slot => <option key={slot} value={slot}>{timeLabel(slot)}</option>)}</select></label>
            <label className="wide">Describe el trabajo o la falla<textarea value={form.notes} onChange={e => update('notes', e.target.value)} /></label>
            {message && <div className="alert error wide">{message}</div>}
            <button className="primary wide" disabled={saving || !form.time}><Clock3 size={18} />{saving ? 'Registrando…' : 'Solicitar cita'}</button>
          </form>
        )}
        <footer className="public-footer"><a href="/mi-moto">Ya soy cliente: ver Mi moto</a><a href="/">Acceso del taller</a></footer>
      </section>
    </main>
  )
}
