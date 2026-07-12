import { useEffect, useState } from 'react'
import {
  Building2,
  Palette,
  CalendarClock,
  CheckCircle2,
  Save,
  ShieldCheck,
  Plus
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const days = [
  ['monday', 'Lunes'],
  ['tuesday', 'Martes'],
  ['wednesday', 'Miércoles'],
  ['thursday', 'Jueves'],
  ['friday', 'Viernes'],
  ['saturday', 'Sábado'],
  ['sunday', 'Domingo']
]

const defaultHours = {
  monday: { open: true, start: '08:00', end: '17:00' },
  tuesday: { open: true, start: '08:00', end: '17:00' },
  wednesday: { open: true, start: '08:00', end: '17:00' },
  thursday: { open: true, start: '08:00', end: '17:00' },
  friday: { open: true, start: '08:00', end: '17:00' },
  saturday: { open: true, start: '08:00', end: '13:00' },
  sunday: { open: false, start: '08:00', end: '17:00' }
}

export default function Settings({ workshop, role, onWorkshopUpdated, onBrandingUpdated = () => {} }) {
  const canEdit = ['owner', 'admin'].includes(role)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [settingsId, setSettingsId] = useState(null)
  const [services, setServices] = useState([])
  const [newService, setNewService] = useState({ name: '', duration_minutes: 60 })
  const [form, setForm] = useState({
    name: workshop?.name || '',
    timezone: workshop?.timezone || 'America/Costa_Rica',
    currency: workshop?.currency || 'CRC',
    legal_name: '',
    tax_id: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    logo_url: '',
    default_tax_rate: 13,
    appointment_slot_minutes: 60,
    manual_appointment_confirmation: true,
    public_booking_enabled: true,
    minimum_booking_notice_hours: 2,
    maximum_booking_days: 60,
    maximum_appointments_per_day: '',
    oil_change_interval_km: 3000,
    business_hours: defaultHours,
    theme_mode: 'light',
    primary_color: '#222222',
    accent_color: '#666666',
    background_color: '#f1f2f3',
    surface_color: '#ffffff',
    text_color: '#181818'
  })

  useEffect(() => { load() }, [workshop?.id])

  async function load() {
    if (!workshop?.id) return
    setLoading(true)

    const [settingsResult, servicesResult] = await Promise.all([
      supabase.from('workshop_settings').select('*').eq('workshop_id', workshop.id).single(),
      supabase.from('appointment_services').select('*').eq('workshop_id', workshop.id).order('name')
    ])
    const { data, error } = settingsResult

    if (error) {
      alert(error.message)
    } else {
      setSettingsId(data.id)
      setForm({
        name: workshop.name || '',
        timezone: workshop.timezone || 'America/Costa_Rica',
        currency: workshop.currency || 'CRC',
        legal_name: data.legal_name || '',
        tax_id: data.tax_id || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        email: data.email || '',
        address: data.address || '',
        logo_url: data.logo_url || '',
        default_tax_rate: data.default_tax_rate ?? 13,
        appointment_slot_minutes: data.appointment_slot_minutes ?? 60,
        manual_appointment_confirmation: data.manual_appointment_confirmation,
        public_booking_enabled: data.public_booking_enabled,
        minimum_booking_notice_hours: data.minimum_booking_notice_hours ?? 2,
        maximum_booking_days: data.maximum_booking_days ?? 60,
        maximum_appointments_per_day: data.maximum_appointments_per_day ?? '',
        oil_change_interval_km: data.oil_change_interval_km ?? 3000,
        business_hours: { ...defaultHours, ...(data.business_hours || {}) },
        theme_mode: data.theme_mode || 'light',
        primary_color: data.primary_color || '#222222',
        accent_color: data.accent_color || '#666666',
        background_color: data.background_color || '#f1f2f3',
        surface_color: data.surface_color || '#ffffff',
        text_color: data.text_color || '#181818'
      })
    }
    if (servicesResult.error) alert(servicesResult.error.message)
    else setServices(servicesResult.data || [])
    setLoading(false)
  }

  function updateService(id, field, value) {
    setSaved(false)
    setServices(current => current.map(service => service.id === id ? { ...service, [field]: value } : service))
  }

  async function addService() {
    if (!newService.name.trim()) return
    const { data, error } = await supabase.from('appointment_services').insert({
      workshop_id: workshop.id,
      name: newService.name.trim(),
      duration_minutes: Number(newService.duration_minutes)
    }).select().single()
    if (error) return alert(`No se pudo agregar el servicio: ${error.message}`)
    setServices(current => [...current, data].sort((a, b) => a.name.localeCompare(b.name)))
    setNewService({ name: '', duration_minutes: 60 })
  }

  function update(field, value) {
    setSaved(false)
    setForm(current => ({ ...current, [field]: value }))
  }

  function updateHours(day, field, value) {
    setSaved(false)
    setForm(current => ({
      ...current,
      business_hours: {
        ...current.business_hours,
        [day]: { ...current.business_hours[day], [field]: value }
      }
    }))
  }

  async function save(event) {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setSaved(false)

    const [workshopResult, settingsResult] = await Promise.all([
      supabase
        .from('workshops')
        .update({
          name: form.name.trim(),
          timezone: form.timezone,
          currency: form.currency,
          updated_at: new Date().toISOString()
        })
        .eq('id', workshop.id)
        .select()
        .single(),
      supabase
        .from('workshop_settings')
        .update({
          legal_name: form.legal_name.trim() || null,
          tax_id: form.tax_id.trim() || null,
          phone: form.phone.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          logo_url: form.logo_url.trim() || null,
          default_tax_rate: Number(form.default_tax_rate),
          appointment_slot_minutes: Number(form.appointment_slot_minutes),
          manual_appointment_confirmation: form.manual_appointment_confirmation,
          public_booking_enabled: form.public_booking_enabled,
          minimum_booking_notice_hours: Number(form.minimum_booking_notice_hours),
          maximum_booking_days: Number(form.maximum_booking_days),
          maximum_appointments_per_day: form.maximum_appointments_per_day ? Number(form.maximum_appointments_per_day) : null,
          oil_change_interval_km: Number(form.oil_change_interval_km),
          business_hours: form.business_hours,
          theme_mode: form.theme_mode,
          primary_color: form.primary_color,
          accent_color: form.accent_color,
          background_color: form.background_color,
          surface_color: form.surface_color,
          text_color: form.text_color,
          updated_at: new Date().toISOString()
        })
        .eq('id', settingsId)
        .select()
        .single()
    ])

    const serviceResults = await Promise.all(services.map(service => supabase
      .from('appointment_services')
      .update({
        name: service.name.trim(),
        duration_minutes: Number(service.duration_minutes),
        public_enabled: service.public_enabled,
        active: service.active
      })
      .eq('id', service.id)))

    setSaving(false)
    const error = workshopResult.error || settingsResult.error || serviceResults.find(result => result.error)?.error
    if (error) {
      alert(`No se pudo guardar la configuración: ${error.message}`)
      return
    }

    onWorkshopUpdated(workshopResult.data)
    onBrandingUpdated(settingsResult.data)
    setSaved(true)
  }

  if (loading) return <section className="panel"><div className="empty">Cargando configuración...</div></section>

  return (
    <form className="settings-page" onSubmit={save}>
      <section className="panel settings-heading">
        <div>
          <span className="eyebrow">CONFIGURACIÓN</span>
          <h2>{form.name}</h2>
          <p className="muted">Preferencias operativas independientes para este taller.</p>
        </div>
        <div className="settings-actions">
          {saved && <span className="settings-saved"><CheckCircle2 size={17} />Guardado</span>}
          <button className="primary compact" disabled={!canEdit || saving}><Save size={18} />{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </section>

      {!canEdit && <div className="settings-readonly"><ShieldCheck size={20} />Tu rol permite consultar esta configuración, pero no modificarla.</div>}

      <div className="settings-grid">
        <section className="panel settings-section">
          <div className="settings-section-title"><Building2 size={22} /><div><h3>Datos del taller</h3><p>Información general y de contacto</p></div></div>
          <div className="settings-fields">
            <label>Nombre visible<input disabled={!canEdit} required value={form.name} onChange={event => update('name', event.target.value)} /></label>
            <label>Nombre legal<input disabled={!canEdit} value={form.legal_name} onChange={event => update('legal_name', event.target.value)} /></label>
            <label>Identificación / cédula<input disabled={!canEdit} value={form.tax_id} onChange={event => update('tax_id', event.target.value)} /></label>
            <label>Teléfono<input disabled={!canEdit} value={form.phone} onChange={event => update('phone', event.target.value)} /></label>
            <label>WhatsApp<input disabled={!canEdit} value={form.whatsapp} onChange={event => update('whatsapp', event.target.value)} /></label>
            <label>Correo<input disabled={!canEdit} type="email" value={form.email} onChange={event => update('email', event.target.value)} /></label>
            <label className="wide">Dirección<textarea disabled={!canEdit} value={form.address} onChange={event => update('address', event.target.value)} /></label>
            <label className="wide">Dirección web del logo<input disabled={!canEdit} placeholder="Se conectará al cargador de logo más adelante" value={form.logo_url} onChange={event => update('logo_url', event.target.value)} /></label>
          </div>
        </section>

        <section className="panel settings-section">
          <div className="settings-section-title"><CalendarClock size={22} /><div><h3>Operación</h3><p>Citas, impuestos y mantenimiento</p></div></div>
          <div className="settings-fields">
            <label>IVA predeterminado (%)<input disabled={!canEdit} type="number" min="0" step="0.01" value={form.default_tax_rate} onChange={event => update('default_tax_rate', event.target.value)} /></label>
            <label>Duración de cita (minutos)<select disabled={!canEdit} value={form.appointment_slot_minutes} onChange={event => update('appointment_slot_minutes', event.target.value)}><option value="30">30</option><option value="45">45</option><option value="60">60</option><option value="90">90</option><option value="120">120</option></select></label>
            <label>Intervalo de aceite (km)<input disabled={!canEdit} type="number" min="1" value={form.oil_change_interval_km} onChange={event => update('oil_change_interval_km', event.target.value)} /></label>
            <label>Zona horaria<select disabled={!canEdit} value={form.timezone} onChange={event => update('timezone', event.target.value)}><option>America/Costa_Rica</option><option>America/Guatemala</option><option>America/Panama</option><option>America/Mexico_City</option></select></label>
            <label>Moneda<select disabled={!canEdit} value={form.currency} onChange={event => update('currency', event.target.value)}><option value="CRC">Colón costarricense (CRC)</option><option value="USD">Dólar (USD)</option></select></label>
            <label className="settings-toggle"><input disabled={!canEdit} type="checkbox" checked={form.manual_appointment_confirmation} onChange={event => update('manual_appointment_confirmation', event.target.checked)} />Confirmación manual de citas</label>
            <label className="settings-toggle"><input disabled={!canEdit} type="checkbox" checked={form.public_booking_enabled} onChange={event => update('public_booking_enabled', event.target.checked)} />Reservas públicas activas</label>
            <label>Anticipación mínima (horas)<input disabled={!canEdit} type="number" min="0" value={form.minimum_booking_notice_hours} onChange={event => update('minimum_booking_notice_hours', event.target.value)} /></label>
            <label>Máximo de días futuros<input disabled={!canEdit} type="number" min="1" value={form.maximum_booking_days} onChange={event => update('maximum_booking_days', event.target.value)} /></label>
            <label>Máximo de citas por día<input disabled={!canEdit} type="number" min="1" placeholder="Sin límite" value={form.maximum_appointments_per_day} onChange={event => update('maximum_appointments_per_day', event.target.value)} /></label>
          </div>
        </section>
      </div>

      <section className="panel settings-section branding-settings">
        <div className="settings-section-title"><Palette size={22} /><div><h3>Identidad visual</h3><p>Colores y apariencia propios de este taller</p></div></div>
        <div className="branding-editor">
          <div className="settings-fields">
            <label>Apariencia<select disabled={!canEdit} value={form.theme_mode} onChange={event => update('theme_mode', event.target.value)}><option value="light">Clara</option><option value="dark">Oscura</option></select></label>
            <label>Color principal<span className="color-field"><input disabled={!canEdit} type="color" value={form.primary_color} onChange={event => update('primary_color', event.target.value)} /><input disabled={!canEdit} value={form.primary_color} onChange={event => update('primary_color', event.target.value)} /></span></label>
            <label>Color secundario<span className="color-field"><input disabled={!canEdit} type="color" value={form.accent_color} onChange={event => update('accent_color', event.target.value)} /><input disabled={!canEdit} value={form.accent_color} onChange={event => update('accent_color', event.target.value)} /></span></label>
            <label>Fondo general<span className="color-field"><input disabled={!canEdit} type="color" value={form.background_color} onChange={event => update('background_color', event.target.value)} /><input disabled={!canEdit} value={form.background_color} onChange={event => update('background_color', event.target.value)} /></span></label>
            <label>Fondo de tarjetas<span className="color-field"><input disabled={!canEdit} type="color" value={form.surface_color} onChange={event => update('surface_color', event.target.value)} /><input disabled={!canEdit} value={form.surface_color} onChange={event => update('surface_color', event.target.value)} /></span></label>
            <label>Color del texto<span className="color-field"><input disabled={!canEdit} type="color" value={form.text_color} onChange={event => update('text_color', event.target.value)} /><input disabled={!canEdit} value={form.text_color} onChange={event => update('text_color', event.target.value)} /></span></label>
          </div>
          <div className="branding-preview" style={{ background: form.background_color, color: form.text_color }}><div style={{ background: form.primary_color, color: '#fff' }}><strong>{form.name}</strong><span>Workshop Manager</span></div><article style={{ background: form.surface_color }}><small style={{ color: form.accent_color }}>VISTA PREVIA</small><h3>Panel del taller</h3><button type="button" style={{ background: form.primary_color, color: '#fff' }}>Acción principal</button></article></div>
        </div>
      </section>

      <section className="panel settings-section booking-services-settings">
        <div className="settings-section-title"><CalendarClock size={22} /><div><h3>Servicios de la agenda</h3><p>Configura cuánto espacio ocupa cada cita; no es el tiempo prometido de reparación.</p></div></div>
        <div className="booking-services-list">
          {services.map(service => <article key={service.id}>
            <input disabled={!canEdit} value={service.name} onChange={event => updateService(service.id, 'name', event.target.value)} />
            <label>Espacio reservado<select disabled={!canEdit} value={service.duration_minutes} onChange={event => updateService(service.id, 'duration_minutes', event.target.value)}><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 hora</option><option value="90">1 hora 30 min</option><option value="120">2 horas</option><option value="180">3 horas</option><option value="240">4 horas</option><option value="480">Día completo (8 h)</option></select></label>
            <label><input disabled={!canEdit} type="checkbox" checked={service.public_enabled} onChange={event => updateService(service.id, 'public_enabled', event.target.checked)} />Visible al cliente</label>
            <label><input disabled={!canEdit} type="checkbox" checked={service.active} onChange={event => updateService(service.id, 'active', event.target.checked)} />Activo</label>
          </article>)}
        </div>
        {canEdit && <div className="new-booking-service"><input placeholder="Nuevo servicio" value={newService.name} onChange={event => setNewService({ ...newService, name: event.target.value })} /><select value={newService.duration_minutes} onChange={event => setNewService({ ...newService, duration_minutes: event.target.value })}><option value="30">30 min</option><option value="60">1 hora</option><option value="90">1 hora 30 min</option><option value="120">2 horas</option><option value="180">3 horas</option></select><button className="secondary" type="button" onClick={addService}><Plus size={17} />Agregar</button></div>}
      </section>

      <section className="panel settings-section">
        <div className="settings-section-title"><CalendarClock size={22} /><div><h3>Horario semanal</h3><p>Días y horas de atención</p></div></div>
        <div className="business-hours">
          {days.map(([key, label]) => {
            const hours = form.business_hours[key]
            return (
              <div className={!hours.open ? 'closed' : ''} key={key}>
                <label className="day-open"><input disabled={!canEdit} type="checkbox" checked={hours.open} onChange={event => updateHours(key, 'open', event.target.checked)} /><strong>{label}</strong></label>
                {hours.open ? <><input disabled={!canEdit} type="time" value={hours.start} onChange={event => updateHours(key, 'start', event.target.value)} /><span>a</span><input disabled={!canEdit} type="time" value={hours.end} onChange={event => updateHours(key, 'end', event.target.value)} /></> : <span className="closed-label">Cerrado</span>}
              </div>
            )
          })}
        </div>
      </section>
    </form>
  )
}
