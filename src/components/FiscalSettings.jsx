import { useEffect, useState } from 'react'
import { BadgeCheck, Landmark, Save, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

const emptyForm = {
  environment: 'test', issuer_name: '', identification_type: '01', identification_number: '',
  economic_activity_code: '', economic_activity_name: '', province_code: '', canton_code: '',
  district_code: '', neighborhood_code: '', other_signs: '', phone_country_code: '506',
  phone_number: '', email: '', branch_code: '001', terminal_code: '00001',
  default_labor_cabys: '', default_parts_cabys: '', enabled: false,
  credentials_configured: false, signing_key_configured: false
}

export default function FiscalSettings({ workshop, role }) {
  const canEdit = ['owner', 'admin'].includes(role)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [workshop?.id])

  async function load() {
    if (!workshop?.id) return
    setLoading(true)
    const { data, error } = await supabase.from('fiscal_settings').select('*').eq('workshop_id', workshop.id).maybeSingle()
    if (error) alert(`No se pudo cargar la configuración fiscal: ${error.message}`)
    if (data) setForm({ ...emptyForm, ...data })
    setLoading(false)
  }

  function update(field, value) {
    setSaved(false)
    setForm(current => ({ ...current, [field]: value }))
  }

  async function save(event) {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    const payload = {
      workshop_id: workshop.id,
      environment: form.environment,
      issuer_name: form.issuer_name.trim(),
      identification_type: form.identification_type,
      identification_number: form.identification_number.replace(/[^0-9]/g, ''),
      economic_activity_code: form.economic_activity_code.replace(/[^0-9]/g, ''),
      economic_activity_name: form.economic_activity_name.trim() || null,
      province_code: form.province_code,
      canton_code: form.canton_code.padStart(2, '0'),
      district_code: form.district_code.padStart(2, '0'),
      neighborhood_code: form.neighborhood_code ? form.neighborhood_code.padStart(2, '0') : null,
      other_signs: form.other_signs.trim(),
      phone_country_code: form.phone_country_code.replace(/[^0-9]/g, ''),
      phone_number: form.phone_number.replace(/[^0-9]/g, ''),
      email: form.email.trim().toLowerCase(),
      branch_code: form.branch_code.padStart(3, '0'),
      terminal_code: form.terminal_code.padStart(5, '0'),
      default_labor_cabys: form.default_labor_cabys.replace(/[^0-9]/g, '') || null,
      default_parts_cabys: form.default_parts_cabys.replace(/[^0-9]/g, '') || null,
      enabled: false,
      updated_at: new Date().toISOString()
    }
    const { data, error } = await supabase.from('fiscal_settings').upsert(payload, { onConflict: 'workshop_id' }).select().single()
    setSaving(false)
    if (error) return alert(`No se pudo guardar: ${error.message}`)
    setForm({ ...emptyForm, ...data })
    setSaved(true)
  }

  if (loading) return <section className="panel settings-section"><div className="empty">Cargando configuración fiscal…</div></section>

  return (
    <section className="panel settings-section fiscal-settings">
      <div className="settings-section-title"><Landmark size={22} /><div><h3>Facturación electrónica Costa Rica</h3><p>Datos para comprobantes electrónicos versión 4.4</p></div></div>
      <div className="fiscal-security-note"><ShieldCheck size={19} /><span>La contraseña de Hacienda, el PIN y la llave .p12 se configurarán en el servidor seguro; nunca se guardan en esta pantalla.</span></div>
      <form onSubmit={save}>
        <div className="settings-fields">
          <label>Ambiente<select disabled={!canEdit} value={form.environment} onChange={event => update('environment', event.target.value)}><option value="test">Pruebas</option><option value="production">Producción</option></select></label>
          <label>Nombre o razón social<input disabled={!canEdit} required value={form.issuer_name} onChange={event => update('issuer_name', event.target.value)} /></label>
          <label>Tipo de identificación<select disabled={!canEdit} value={form.identification_type} onChange={event => update('identification_type', event.target.value)}><option value="01">Cédula física</option><option value="02">Cédula jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></label>
          <label>Número de identificación<input disabled={!canEdit} required inputMode="numeric" value={form.identification_number} onChange={event => update('identification_number', event.target.value)} /></label>
          <label>Código de actividad económica<input disabled={!canEdit} required inputMode="numeric" value={form.economic_activity_code} onChange={event => update('economic_activity_code', event.target.value)} /></label>
          <label>Nombre de la actividad<input disabled={!canEdit} value={form.economic_activity_name} onChange={event => update('economic_activity_name', event.target.value)} /></label>
          <label>Provincia (1 dígito)<input disabled={!canEdit} required maxLength="1" value={form.province_code} onChange={event => update('province_code', event.target.value)} /></label>
          <label>Cantón (2 dígitos)<input disabled={!canEdit} required maxLength="2" value={form.canton_code} onChange={event => update('canton_code', event.target.value)} /></label>
          <label>Distrito (2 dígitos)<input disabled={!canEdit} required maxLength="2" value={form.district_code} onChange={event => update('district_code', event.target.value)} /></label>
          <label>Barrio (opcional, 2 dígitos)<input disabled={!canEdit} maxLength="2" value={form.neighborhood_code} onChange={event => update('neighborhood_code', event.target.value)} /></label>
          <label>Sucursal<input disabled={!canEdit} required maxLength="3" value={form.branch_code} onChange={event => update('branch_code', event.target.value)} /></label>
          <label>Caja / terminal<input disabled={!canEdit} required maxLength="5" value={form.terminal_code} onChange={event => update('terminal_code', event.target.value)} /></label>
          <label>Indicativo telefónico<input disabled={!canEdit} required value={form.phone_country_code} onChange={event => update('phone_country_code', event.target.value)} /></label>
          <label>Teléfono<input disabled={!canEdit} required value={form.phone_number} onChange={event => update('phone_number', event.target.value)} /></label>
          <label>Correo fiscal<input disabled={!canEdit} required type="email" value={form.email} onChange={event => update('email', event.target.value)} /></label>
          <label className="wide">Otras señas<input disabled={!canEdit} required value={form.other_signs} onChange={event => update('other_signs', event.target.value)} /></label>
          <label>CABYS mano de obra<input disabled={!canEdit} inputMode="numeric" value={form.default_labor_cabys} onChange={event => update('default_labor_cabys', event.target.value)} /></label>
          <label>CABYS repuestos<input disabled={!canEdit} inputMode="numeric" value={form.default_parts_cabys} onChange={event => update('default_parts_cabys', event.target.value)} /></label>
        </div>
        <div className="settings-actions">
          {saved && <span className="settings-saved"><BadgeCheck size={17} />Datos fiscales guardados</span>}
          <button className="primary compact" disabled={!canEdit || saving}><Save size={18} />{saving ? 'Guardando…' : 'Guardar datos fiscales'}</button>
        </div>
      </form>
    </section>
  )
}
