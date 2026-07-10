import { useEffect, useState } from 'react'
import { Plus, Search, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Customers() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    notes: '',
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
      return
    }

    setRows(data || [])
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)

    const { error } = await supabase.from('customers').insert({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    })

    setSaving(false)

    if (error) {
      alert(error.message)
      return
    }

    setForm({
      full_name: '',
      phone: '',
      email: '',
      notes: '',
    })

    setShow(false)
    load()
  }

  const filteredRows = rows.filter(customer => {
    const text = `
      ${customer.full_name}
      ${customer.phone}
      ${customer.email || ''}
    `.toLowerCase()

    return text.includes(search.toLowerCase().trim())
  })

  function whatsappLink(phone) {
    const cleanPhone = phone.replace(/\D/g, '')
    const fullPhone = cleanPhone.startsWith('506')
      ? cleanPhone
      : `506${cleanPhone}`

    return `https://wa.me/${fullPhone}`
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">CLIENTES</span>
            <h2>Base de clientes</h2>
          </div>

          <button
            className="primary compact"
            onClick={() => setShow(!show)}
          >
            <Plus size={18} />
            Nuevo cliente
          </button>
        </div>

        <div className="customer-toolbar">
          <div className="search-box">
            <Search size={18} />

            <input
              type="search"
              placeholder="Buscar por nombre, teléfono o correo"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <span className="customer-count">
            {filteredRows.length} clientes
          </span>
        </div>

        {show && (
          <form className="inline-form" onSubmit={save}>
            <label>
              Nombre
              <input
                required
                value={form.full_name}
                onChange={event =>
                  setForm({
                    ...form,
                    full_name: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Teléfono
              <input
                required
                value={form.phone}
                onChange={event =>
                  setForm({
                    ...form,
                    phone: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Correo
              <input
                type="email"
                value={form.email}
                onChange={event =>
                  setForm({
                    ...form,
                    email: event.target.value,
                  })
                }
              />
            </label>

            <label className="wide">
              Notas
              <textarea
                value={form.notes}
                onChange={event =>
                  setForm({
                    ...form,
                    notes: event.target.value,
                  })
                }
              />
            </label>

            <button className="primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </form>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Notas</th>
                <th>Contacto</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map(customer => (
                <tr key={customer.id}>
                  <td>
                    <strong>{customer.full_name}</strong>
                  </td>

                  <td>{customer.phone}</td>

                  <td>{customer.email || '—'}</td>

                  <td>{customer.notes || '—'}</td>

                  <td>
                    <a
                      className="icon-action"
                      href={whatsappLink(customer.phone)}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir WhatsApp"
                    >
                      <MessageCircle size={18} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredRows.length && (
          <div className="empty">
            No hay clientes que coincidan con la búsqueda.
          </div>
        )}
      </section>
    </>
  )
}