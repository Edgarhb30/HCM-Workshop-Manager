import { useEffect, useState } from 'react'
import { BookOpenCheck, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const emptyStep = () => ({ test_name: '', instruction: '', component: '', expected_value: '', safety_note: '' })
const emptyForm = () => ({ title: '', symptom: '', brand: '', model: '', description: '', steps: [emptyStep()] })

export default function DiagnosticGuides() {
  const [guides, setGuides] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('diagnostic_guides')
      .select('*, steps:diagnostic_guide_steps(*)').order('created_at', { ascending: false })
    if (error) alert(`No se pudieron cargar las guías: ${error.message}`)
    else setGuides((data || []).map(guide => ({ ...guide, steps: [...(guide.steps || [])].sort((a, b) => a.step_number - b.step_number) })))
    setLoading(false)
  }

  function updateStep(index, field, value) {
    setForm(current => ({ ...current, steps: current.steps.map((step, position) => position === index ? { ...step, [field]: value } : step) }))
  }

  async function save(event) {
    event.preventDefault()
    if (form.steps.some(step => !step.test_name.trim() || !step.instruction.trim())) return alert('Cada paso necesita nombre e instrucción.')
    setSaving(true)
    const { error } = await supabase.rpc('create_diagnostic_guide', {
      p_title: form.title, p_symptom: form.symptom, p_brand: form.brand,
      p_model: form.model, p_description: form.description, p_steps: form.steps
    })
    setSaving(false)
    if (error) return alert(`No se pudo crear la guía: ${error.message}`)
    setForm(emptyForm())
    setShowForm(false)
    load()
  }

  return <section className="panel diagnostic-guides-page">
    <div className="panel-title"><div><span className="eyebrow">DIAGNÓSTICO GUIADO</span><h2>Guías técnicas</h2><p className="muted">Procedimientos creados por el taller, sin valores inventados.</p></div>
      <button className="primary compact" type="button" onClick={() => setShowForm(!showForm)}>{showForm ? <X size={18} /> : <Plus size={18} />}{showForm ? 'Cerrar' : 'Nueva guía'}</button>
    </div>
    {showForm && <form className="guide-form" onSubmit={save}>
      <label>Nombre de la guía<input required placeholder="Ejemplo: No enciende - sistema de inyección" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
      <label>Síntoma principal<input required value={form.symptom} onChange={event => setForm({ ...form, symptom: event.target.value })} /></label>
      <label>Marca (opcional)<input value={form.brand} onChange={event => setForm({ ...form, brand: event.target.value })} /></label>
      <label>Modelo (opcional)<input value={form.model} onChange={event => setForm({ ...form, model: event.target.value })} /></label>
      <label className="wide">Descripción<textarea rows="2" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      <div className="guide-steps wide"><h3>Pasos del procedimiento</h3>{form.steps.map((step, index) => <article key={index}>
        <strong>Paso {index + 1}</strong>
        <label>Nombre de la prueba<input required value={step.test_name} onChange={event => updateStep(index, 'test_name', event.target.value)} /></label>
        <label>Componente<input value={step.component} onChange={event => updateStep(index, 'component', event.target.value)} /></label>
        <label className="wide">Qué debe hacer el técnico<textarea required rows="2" value={step.instruction} onChange={event => updateStep(index, 'instruction', event.target.value)} /></label>
        <label>Valor esperado<input value={step.expected_value} onChange={event => updateStep(index, 'expected_value', event.target.value)} /></label>
        <label>Advertencia de seguridad<input value={step.safety_note} onChange={event => updateStep(index, 'safety_note', event.target.value)} /></label>
        {form.steps.length > 1 && <button className="icon" type="button" title="Eliminar paso" onClick={() => setForm({ ...form, steps: form.steps.filter((_, position) => position !== index) })}><Trash2 size={17} /></button>}
      </article>)}</div>
      <button className="secondary wide" type="button" onClick={() => setForm({ ...form, steps: [...form.steps, emptyStep()] })}><Plus size={17} />Agregar paso</button>
      <button className="primary" disabled={saving}>{saving ? 'Guardando guía…' : 'Guardar guía técnica'}</button>
    </form>}
    {loading ? <div className="empty">Cargando guías…</div> : <div className="guide-list">{guides.map(guide => <article key={guide.id}><BookOpenCheck size={24} /><div><span>{guide.brand || 'Todas las marcas'} {guide.model || ''}</span><strong>{guide.title}</strong><p>{guide.symptom}</p><small>{guide.steps.length} pasos</small></div></article>)}</div>}
    {!loading && !guides.length && <div className="empty">Todavía no hay guías técnicas.</div>}
  </section>
}

