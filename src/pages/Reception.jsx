import { useEffect, useMemo, useState } from 'react'
import {
  UserRound,
  Bike,
  CalendarDays,
  Camera,
  Search,
  ArrowRight,
  CheckCircle2,
  Plus,
  X,
  ClipboardCheck,
  Trash2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import SignaturePad from '../components/SignaturePad'

const emptyCustomerForm = {
  full_name: '',
  phone: '',
  email: '',
  notes: ''
}

const emptyMotorcycleForm = {
  brand: '',
  model: '',
  motorcycle_year: '',
  plate: '',
  color: '',
  vin: '',
  mileage: '',
  notes: ''
}

const emptyReceptionForm = {
  mileage: '',
  fuel_level: '1/2',
  main_key: true,
  spare_key: false,
  documents: false,
  other_items: '',
  low_beam: 'Funciona',
  high_beam: 'Funciona',
  stop_light: 'Funciona',
  left_turn_signal: 'Funciona',
  right_turn_signal: 'Funciona',
  horn: 'Funciona',
  starts: 'Sí',
  oil_leak: false,
  fuel_leak: false,
  coolant_leak: false,
  body_damage: false,
  scratches: false,
  missing_parts: false,
  inspection_notes: '',
  intake_notes: '',
  internal_notes: ''
}

const electricalChecks = [
  ['low_beam', 'Luz baja'],
  ['high_beam', 'Luz alta'],
  ['stop_light', 'Luz de freno / stop'],
  ['left_turn_signal', 'Direccional izquierda'],
  ['right_turn_signal', 'Direccional derecha'],
  ['horn', 'Bocina / pito']
]

const conditionChecks = [
  ['oil_leak', 'Fuga de aceite'],
  ['fuel_leak', 'Fuga de combustible'],
  ['coolant_leak', 'Fuga de refrigerante'],
  ['body_damage', 'Golpes o daños en tapas'],
  ['scratches', 'Rayones visibles'],
  ['missing_parts', 'Tornillos o piezas faltantes']
]

const photoTypes = [
  'Frente',
  'Lado izquierdo',
  'Lado derecho',
  'Parte trasera',
  'Tablero',
  'Daño',
  'Otro'
]

const cleanPhone = value => String(value || '').replace(/\D/g, '')

const appointmentMotorcycle = appointment => ({
  ...emptyMotorcycleForm,
  brand: appointment?.brand || '',
  model: appointment?.model || '',
  motorcycle_year: appointment?.motorcycle_year || '',
  plate: appointment?.plate || '',
  notes: appointment?.customer_notes || ''
})

export default function Reception({
  initialAppointment = null,
  clearInitialAppointment = () => {},
  workshop = null
}) {
  const [customers, setCustomers] = useState([])
  const [motorcycles, setMotorcycles] = useState([])

  const [customerSearch, setCustomerSearch] = useState('')
  const [motorcycleSearch, setMotorcycleSearch] = useState('')

  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedMotorcycle, setSelectedMotorcycle] = useState(null)

  const [showMotorcycleForm, setShowMotorcycleForm] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showReceptionForm, setShowReceptionForm] = useState(false)

  const [customerForm, setCustomerForm] = useState(emptyCustomerForm)

  const [motorcycleForm, setMotorcycleForm] = useState(
    emptyMotorcycleForm
  )

  const [receptionForm, setReceptionForm] = useState(
    emptyReceptionForm
  )

  const [loading, setLoading] = useState(true)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [savingMotorcycle, setSavingMotorcycle] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [createdOrder, setCreatedOrder] = useState(null)
  const [appointmentLoaded, setAppointmentLoaded] = useState(false)
  const [photos, setPhotos] = useState([])
  const [clientSignature, setClientSignature] = useState('')
  const [signerName, setSignerName] = useState('')
  const [mediaResult, setMediaResult] = useState({ photos: 0, signature: false, warning: '' })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!initialAppointment || loading || appointmentLoaded) return

    setAppointmentLoaded(true)
    const intake = [
      initialAppointment.service,
      initialAppointment.customer_notes
    ].filter(Boolean).join(' — ')
    const customer = customers.find(item =>
      cleanPhone(item.phone) === cleanPhone(initialAppointment.phone)
    )

    setReceptionForm({
      ...emptyReceptionForm,
      intake_notes: intake
    })

    if (!customer) {
      setCustomerForm({
        full_name: initialAppointment.customer_name || '',
        phone: initialAppointment.phone || '',
        email: initialAppointment.email || '',
        notes: 'Cliente creado desde una cita.'
      })
      setShowCustomerForm(true)
      return
    }

    setSelectedCustomer(customer)
    const motorcycle = motorcycles.find(item =>
      item.customer_id === customer.id &&
      item.brand?.toLowerCase() === initialAppointment.brand?.toLowerCase() &&
      item.model?.toLowerCase() === initialAppointment.model?.toLowerCase()
    )

    if (motorcycle) {
      setSelectedMotorcycle(motorcycle)
      setReceptionForm(current => ({
        ...current,
        mileage: motorcycle.mileage ?? ''
      }))
      return
    }

    setMotorcycleForm(appointmentMotorcycle(initialAppointment))
    setShowMotorcycleForm(true)
  }, [initialAppointment, loading, appointmentLoaded, customers, motorcycles])

  async function loadData() {
    setLoading(true)

    const [customersResult, motorcyclesResult] = await Promise.all([
      supabase
        .from('customers')
        .select('*')
        .order('full_name'),

      supabase
        .from('motorcycles')
        .select('*')
        .order('brand')
        .order('model')
    ])

    if (customersResult.error) {
      alert(customersResult.error.message)
    }

    if (motorcyclesResult.error) {
      alert(motorcyclesResult.error.message)
    }

    setCustomers(customersResult.data || [])
    setMotorcycles(motorcyclesResult.data || [])
    setLoading(false)
  }

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.toLowerCase().trim()

    if (!search) return customers

    return customers.filter(customer => {
      const text = `
        ${customer.full_name}
        ${customer.phone}
        ${customer.email || ''}
      `.toLowerCase()

      return text.includes(search)
    })
  }, [customers, customerSearch])

  const customerMotorcycles = useMemo(() => {
    if (!selectedCustomer) return []

    const search = motorcycleSearch.toLowerCase().trim()

    return motorcycles.filter(motorcycle => {
      const belongsToCustomer =
        motorcycle.customer_id === selectedCustomer.id

      const text = `
        ${motorcycle.brand}
        ${motorcycle.model}
        ${motorcycle.plate || ''}
        ${motorcycle.vin || ''}
      `.toLowerCase()

      return belongsToCustomer && text.includes(search)
    })
  }, [motorcycles, selectedCustomer, motorcycleSearch])

  function chooseCustomer(customer) {
    setSelectedCustomer(customer)
    setSelectedMotorcycle(null)
    setShowMotorcycleForm(false)
    setShowCustomerForm(false)
    setShowReceptionForm(false)
    setMotorcycleSearch('')
    setCreatedOrder(null)
    setSignerName(customer.full_name || '')
  }

  function chooseMotorcycle(motorcycle) {
    setSelectedMotorcycle(motorcycle)

    setReceptionForm({
      ...emptyReceptionForm,
      mileage:
        motorcycle.mileage !== null &&
        motorcycle.mileage !== undefined
          ? String(motorcycle.mileage)
          : ''
    })
  }

  function restart() {
    photos.forEach(photo => URL.revokeObjectURL(photo.preview))
    clearInitialAppointment()
    setSelectedCustomer(null)
    setSelectedMotorcycle(null)
    setCustomerSearch('')
    setMotorcycleSearch('')
    setShowMotorcycleForm(false)
    setShowCustomerForm(false)
    setShowReceptionForm(false)
    setMotorcycleForm(emptyMotorcycleForm)
    setCustomerForm(emptyCustomerForm)
    setReceptionForm(emptyReceptionForm)
    setCreatedOrder(null)
    setAppointmentLoaded(false)
    setPhotos([])
    setClientSignature('')
    setSignerName('')
    setMediaResult({ photos: 0, signature: false, warning: '' })
  }

  function updateMotorcycleForm(field, value) {
    setMotorcycleForm(current => ({
      ...current,
      [field]: value
    }))
  }

  function updateCustomerForm(field, value) {
    setCustomerForm(current => ({
      ...current,
      [field]: value
    }))
  }

  function updateReceptionForm(field, value) {
    setReceptionForm(current => ({
      ...current,
      [field]: value
    }))
  }

  function addPhotos(event) {
    const files = [...event.target.files]
    const next = files.map((file, index) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      photo_type: photoTypes[Math.min(index, photoTypes.length - 1)],
      caption: '',
      client_visible: false
    }))
    setPhotos(current => [...current, ...next])
    event.target.value = ''
  }

  function updatePhoto(id, field, value) {
    setPhotos(current =>
      current.map(photo => photo.id === id ? { ...photo, [field]: value } : photo)
    )
  }

  function removePhoto(id) {
    setPhotos(current => {
      const removed = current.find(photo => photo.id === id)
      if (removed) URL.revokeObjectURL(removed.preview)
      return current.filter(photo => photo.id !== id)
    })
  }

  async function uploadReceptionMedia(order) {
    if (!workshop?.id) {
      return { photos: 0, signature: false, warning: 'No se encontró el taller activo.' }
    }

    let uploadedPhotos = 0
    let signatureUploaded = false
    const errors = []

    for (const photo of photos) {
      const extension = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${workshop.id}/${order.id}/photos/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('work-order-media')
        .upload(path, photo.file, { contentType: photo.file.type, upsert: false })

      if (uploadError) {
        errors.push(uploadError.message)
        continue
      }

      const { error: recordError } = await supabase
        .from('work_order_photos')
        .insert({
          work_order_id: order.id,
          motorcycle_id: selectedMotorcycle.id,
          storage_path: path,
          photo_type: photo.photo_type,
          caption: photo.caption.trim() || null,
          client_visible: photo.client_visible
        })

      if (recordError) errors.push(recordError.message)
      else uploadedPhotos += 1
    }

    if (clientSignature) {
      const blob = await fetch(clientSignature).then(response => response.blob())
      const path = `${workshop.id}/${order.id}/signatures/client-${crypto.randomUUID()}.png`
      const { error: uploadError } = await supabase.storage
        .from('work-order-media')
        .upload(path, blob, { contentType: 'image/png', upsert: false })

      if (uploadError) {
        errors.push(uploadError.message)
      } else {
        const { error: recordError } = await supabase
          .from('work_order_signatures')
          .insert({
            work_order_id: order.id,
            signer_type: 'Cliente',
            signer_name: signerName.trim() || selectedCustomer.full_name,
            storage_path: path
          })

        if (recordError) errors.push(recordError.message)
        else signatureUploaded = true
      }
    }

    return {
      photos: uploadedPhotos,
      signature: signatureUploaded,
      warning: errors.length ? `Algunos archivos no se guardaron: ${errors[0]}` : ''
    }
  }

  async function saveCustomer(event) {
    event.preventDefault()
    setSavingCustomer(true)

    const { data, error } = await supabase
      .from('customers')
      .insert({
        full_name: customerForm.full_name.trim(),
        phone: customerForm.phone.trim(),
        email: customerForm.email.trim() || null,
        notes: customerForm.notes.trim() || null
      })
      .select()
      .single()

    setSavingCustomer(false)

    if (error) {
      alert(`No se pudo guardar el cliente: ${error.message}`)
      return
    }

    setCustomers(current => [...current, data])
    setCustomerForm(emptyCustomerForm)
    setShowCustomerForm(false)
    chooseCustomer(data)

    if (initialAppointment) {
      setMotorcycleForm(appointmentMotorcycle(initialAppointment))
      setShowMotorcycleForm(true)
    }
  }

  async function saveMotorcycle(event) {
    event.preventDefault()

    if (!selectedCustomer) return

    setSavingMotorcycle(true)

    const newMotorcycle = {
      customer_id: selectedCustomer.id,
      brand: motorcycleForm.brand.trim(),
      model: motorcycleForm.model.trim(),
      motorcycle_year: motorcycleForm.motorcycle_year
        ? Number(motorcycleForm.motorcycle_year)
        : null,
      plate: motorcycleForm.plate.trim().toUpperCase() || null,
      color: motorcycleForm.color.trim() || null,
      vin: motorcycleForm.vin.trim().toUpperCase() || null,
      mileage: motorcycleForm.mileage
        ? Number(motorcycleForm.mileage)
        : null,
      notes: motorcycleForm.notes.trim() || null
    }

    const { data, error } = await supabase
      .from('motorcycles')
      .insert(newMotorcycle)
      .select()
      .single()

    setSavingMotorcycle(false)

    if (error) {
      alert(error.message)
      return
    }

    setMotorcycles(current => [...current, data])
    chooseMotorcycle(data)
    setShowMotorcycleForm(false)
    setMotorcycleForm(emptyMotorcycleForm)
  }

  async function createWorkOrder(event) {
    event.preventDefault()

    if (!selectedCustomer || !selectedMotorcycle) return

    if (!receptionForm.intake_notes.trim()) {
      alert('Escribe el motivo de ingreso de la motocicleta.')
      return
    }

    setSavingOrder(true)

    const inspection = [
      receptionForm.documents && 'Documentos: Sí',
      receptionForm.other_items.trim() &&
        `Otros elementos: ${receptionForm.other_items.trim()}`,
      ...electricalChecks.map(
        ([field, label]) => `${label}: ${receptionForm[field]}`
      ),
      `La motocicleta enciende: ${receptionForm.starts}`,
      ...conditionChecks.map(
        ([field, label]) =>
          `${label}: ${receptionForm[field] ? 'Sí' : 'No'}`
      ),
      receptionForm.inspection_notes.trim() &&
        `Detalle de inspección: ${receptionForm.inspection_notes.trim()}`
    ].filter(Boolean)

    const orderData = {
      customer_id: selectedCustomer.id,
      motorcycle_id: selectedMotorcycle.id,
      status: 'Recepción',
      mileage: receptionForm.mileage
        ? Number(receptionForm.mileage)
        : null,
      fuel_level: receptionForm.fuel_level,
      main_key: receptionForm.main_key,
      spare_key: receptionForm.spare_key,
      accessories: inspection,
      intake_notes: receptionForm.intake_notes.trim(),
      internal_notes:
        receptionForm.internal_notes.trim() || null
    }

    const { data, error } = await supabase
      .from('work_orders')
      .insert(orderData)
      .select()
      .single()

    if (error) {
      setSavingOrder(false)
      alert(error.message)
      return
    }

    if (receptionForm.mileage) {
      await supabase
        .from('motorcycles')
        .update({
          mileage: Number(receptionForm.mileage)
        })
        .eq('id', selectedMotorcycle.id)
    }

    if (initialAppointment?.id) {
      await supabase
        .from('appointments')
        .update({ status: 'Completada' })
        .eq('id', initialAppointment.id)
    }

    const uploadedMedia = await uploadReceptionMedia(data)
    setMediaResult(uploadedMedia)
    setCreatedOrder(data)
    setSavingOrder(false)
  }

  if (createdOrder) {
    return (
      <section className="panel">
        <div className="reception-ready">
          <CheckCircle2 size={48} />

          <span className="eyebrow">
            ORDEN CREADA CORRECTAMENTE
          </span>

          <h2>{createdOrder.order_number}</h2>

          <p>
            {selectedCustomer.full_name}
            <br />
            {selectedMotorcycle.brand}{' '}
            {selectedMotorcycle.model}
          </p>

          <div className="media-success-summary">
            <span>{mediaResult.photos} fotografías guardadas</span>
            <span>{mediaResult.signature ? 'Firma del cliente guardada' : 'Sin firma del cliente'}</span>
            {mediaResult.warning && <small>{mediaResult.warning}</small>}
          </div>

          <button
            type="button"
            className="primary"
            onClick={restart}
          >
            Recibir otra motocicleta
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">
            RECEPCIÓN DE MOTOCICLETAS
          </span>

          <h2>
            {!selectedCustomer
              ? 'Selecciona el cliente'
              : !selectedMotorcycle
                ? 'Selecciona la motocicleta'
                : 'Registrar ingreso'}
          </h2>

          <p>
            Completa el ingreso para generar la Orden de Trabajo.
          </p>
        </div>

        {(selectedCustomer || selectedMotorcycle) && (
          <button
            type="button"
            className="secondary"
            onClick={restart}
          >
            Reiniciar
          </button>
        )}
      </div>

      {initialAppointment && (
        <div className="appointment-reception-banner">
          <CalendarDays size={21} />
          <div>
            <strong>Recepción iniciada desde la cita</strong>
            <span>
              {initialAppointment.appointment_date} ·{' '}
              {String(initialAppointment.appointment_time).slice(0, 5)} ·{' '}
              {initialAppointment.customer_name}
            </span>
          </div>
        </div>
      )}

      <div className="reception-progress">
        <div className="reception-progress-step active">
          <span>1</span>
          Cliente
        </div>

        <div
          className={`reception-progress-step ${
            selectedCustomer ? 'active' : ''
          }`}
        >
          <span>2</span>
          Motocicleta
        </div>

        <div
          className={`reception-progress-step ${
            selectedMotorcycle ? 'active' : ''
          }`}
        >
          <span>3</span>
          Recepción
        </div>
      </div>

      {!selectedCustomer && (
        <div className="reception-section">
          <div className="reception-section-heading">
            <UserRound size={24} />

            <div>
              <h3>Buscar cliente</h3>
              <p>Busca por nombre, teléfono o correo.</p>
            </div>
          </div>

          <div className="search-box">
            <Search size={18} />

            <input
              type="search"
              placeholder="Escribe el nombre o teléfono"
              value={customerSearch}
              onChange={event =>
                setCustomerSearch(event.target.value)
              }
            />
          </div>

          {loading ? (
            <div className="empty">
              Cargando clientes...
            </div>
          ) : (
            <div className="selection-list">
              {filteredCustomers.map(customer => (
                <button
                  type="button"
                  className="selection-card"
                  key={customer.id}
                  onClick={() => chooseCustomer(customer)}
                >
                  <div>
                    <strong>{customer.full_name}</strong>
                    <span>{customer.phone}</span>
                  </div>

                  <ArrowRight size={20} />
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="primary compact"
            onClick={() =>
              setShowCustomerForm(current => !current)
            }
          >
            {showCustomerForm ? <X size={18} /> : <Plus size={18} />}
            {showCustomerForm
              ? 'Cerrar formulario'
              : 'Cliente nuevo'}
          </button>

          {showCustomerForm && (
            <form className="inline-form" onSubmit={saveCustomer}>
              <label>
                Nombre completo
                <input
                  required
                  value={customerForm.full_name}
                  onChange={event =>
                    updateCustomerForm('full_name', event.target.value)
                  }
                />
              </label>

              <label>
                Teléfono
                <input
                  required
                  value={customerForm.phone}
                  onChange={event =>
                    updateCustomerForm('phone', event.target.value)
                  }
                />
              </label>

              <label>
                Correo
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={event =>
                    updateCustomerForm('email', event.target.value)
                  }
                />
              </label>

              <label className="wide">
                Notas
                <textarea
                  value={customerForm.notes}
                  onChange={event =>
                    updateCustomerForm('notes', event.target.value)
                  }
                />
              </label>

              <button className="primary" disabled={savingCustomer}>
                {savingCustomer
                  ? 'Guardando cliente...'
                  : 'Guardar cliente y continuar'}
              </button>
            </form>
          )}
        </div>
      )}

      {selectedCustomer && !selectedMotorcycle && (
        <div className="reception-section">
          <div className="selected-summary">
            <CheckCircle2 size={21} />

            <div>
              <span>Cliente seleccionado</span>
              <strong>{selectedCustomer.full_name}</strong>
              <small>{selectedCustomer.phone}</small>
            </div>
          </div>

          <div className="reception-section-heading">
            <Bike size={24} />

            <div>
              <h3>Motocicletas del cliente</h3>
              <p>
                Selecciona una moto existente o registra una nueva.
              </p>
            </div>
          </div>

          <div className="search-box">
            <Search size={18} />

            <input
              type="search"
              placeholder="Buscar por marca, modelo o placa"
              value={motorcycleSearch}
              onChange={event =>
                setMotorcycleSearch(event.target.value)
              }
            />
          </div>

          <div className="selection-list">
            {customerMotorcycles.map(motorcycle => (
              <button
                type="button"
                className="selection-card"
                key={motorcycle.id}
                onClick={() => chooseMotorcycle(motorcycle)}
              >
                <div>
                  <strong>
                    {motorcycle.brand} {motorcycle.model}
                  </strong>

                  <span>
                    {motorcycle.plate
                      ? `Placa: ${motorcycle.plate}`
                      : 'Sin placa registrada'}
                  </span>
                </div>

                <ArrowRight size={20} />
              </button>
            ))}
          </div>

          <button
            type="button"
            className="primary compact"
            onClick={() =>
              setShowMotorcycleForm(current => !current)
            }
          >
            {showMotorcycleForm ? (
              <X size={18} />
            ) : (
              <Plus size={18} />
            )}

            {showMotorcycleForm
              ? 'Cerrar formulario'
              : 'Registrar nueva motocicleta'}
          </button>

          {showMotorcycleForm && (
            <form
              className="inline-form"
              onSubmit={saveMotorcycle}
            >
              <label>
                Marca
                <input
                  required
                  value={motorcycleForm.brand}
                  onChange={event =>
                    updateMotorcycleForm(
                      'brand',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Modelo
                <input
                  required
                  value={motorcycleForm.model}
                  onChange={event =>
                    updateMotorcycleForm(
                      'model',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Año
                <input
                  type="number"
                  min="1950"
                  max="2035"
                  value={motorcycleForm.motorcycle_year}
                  onChange={event =>
                    updateMotorcycleForm(
                      'motorcycle_year',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Placa
                <input
                  value={motorcycleForm.plate}
                  onChange={event =>
                    updateMotorcycleForm(
                      'plate',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Color
                <input
                  value={motorcycleForm.color}
                  onChange={event =>
                    updateMotorcycleForm(
                      'color',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                VIN o número de chasis
                <input
                  value={motorcycleForm.vin}
                  onChange={event =>
                    updateMotorcycleForm(
                      'vin',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Kilometraje actual
                <input
                  type="number"
                  min="0"
                  value={motorcycleForm.mileage}
                  onChange={event =>
                    updateMotorcycleForm(
                      'mileage',
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="wide">
                Observaciones
                <textarea
                  value={motorcycleForm.notes}
                  onChange={event =>
                    updateMotorcycleForm(
                      'notes',
                      event.target.value
                    )
                  }
                />
              </label>

              <button
                className="primary"
                disabled={savingMotorcycle}
              >
                {savingMotorcycle
                  ? 'Guardando motocicleta...'
                  : 'Guardar y seleccionar motocicleta'}
              </button>
            </form>
          )}
        </div>
      )}

      {selectedCustomer && selectedMotorcycle && (
        <div className="reception-section">
          <div className="selected-summary">
            <CheckCircle2 size={21} />

            <div>
              <span>Cliente</span>
              <strong>{selectedCustomer.full_name}</strong>
              <small>{selectedCustomer.phone}</small>
            </div>
          </div>

          <div className="selected-summary">
            <CheckCircle2 size={21} />

            <div>
              <span>Motocicleta</span>
              <strong>
                {selectedMotorcycle.brand}{' '}
                {selectedMotorcycle.model}
              </strong>
              <small>
                {selectedMotorcycle.plate
                  ? `Placa: ${selectedMotorcycle.plate}`
                  : 'Sin placa registrada'}
              </small>
            </div>
          </div>

          {!showReceptionForm ? (
            <div className="reception-ready">
              <ClipboardCheck size={38} />

              <h3>Listos para registrar el ingreso</h3>

              <button
                type="button"
                className="primary"
                onClick={() => setShowReceptionForm(true)}
              >
                Continuar con la recepción
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <form
              className="inline-form"
              onSubmit={createWorkOrder}
            >
              <label>
                Kilometraje de entrada
                <input
                  type="number"
                  min="0"
                  value={receptionForm.mileage}
                  onChange={event =>
                    updateReceptionForm(
                      'mileage',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Nivel de combustible
                <select
                  value={receptionForm.fuel_level}
                  onChange={event =>
                    updateReceptionForm(
                      'fuel_level',
                      event.target.value
                    )
                  }
                >
                  <option>Vacío</option>
                  <option>1/4</option>
                  <option>1/2</option>
                  <option>3/4</option>
                  <option>Lleno</option>
                </select>
              </label>

              <label>
                <span>Llaves entregadas</span>

                <label>
                  <input
                    type="checkbox"
                    checked={receptionForm.main_key}
                    onChange={event =>
                      updateReceptionForm(
                        'main_key',
                        event.target.checked
                      )
                    }
                  />
                  Llave principal
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={receptionForm.spare_key}
                    onChange={event =>
                      updateReceptionForm(
                        'spare_key',
                        event.target.checked
                      )
                    }
                  />
                  Llave de repuesto
                </label>
              </label>

              <div className="wide inspection-block">
                <h3>Elementos entregados</h3>
                <div className="inspection-grid compact-grid">
                  <label className="check-card">
                    <input
                      type="checkbox"
                      checked={receptionForm.documents}
                      onChange={event =>
                        updateReceptionForm(
                          'documents',
                          event.target.checked
                        )
                      }
                    />
                    Documentos
                  </label>

                  <label>
                    Otros elementos
                    <input
                      placeholder="Ejemplo: control de alarma"
                      value={receptionForm.other_items}
                      onChange={event =>
                        updateReceptionForm(
                          'other_items',
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="wide inspection-block">
                <h3>Inspección eléctrica</h3>
                <p className="muted">
                  Comprueba las luces, direccionales y bocina al recibir la moto.
                </p>

                <div className="inspection-grid">
                  {electricalChecks.map(([field, label]) => (
                    <label key={field}>
                      {label}
                      <select
                        value={receptionForm[field]}
                        onChange={event =>
                          updateReceptionForm(field, event.target.value)
                        }
                      >
                        <option>Funciona</option>
                        <option>No funciona</option>
                        <option>No aplica</option>
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="wide inspection-block">
                <h3>Funcionamiento y estado físico</h3>

                <div className="inspection-grid">
                  <label>
                    ¿La motocicleta enciende?
                    <select
                      value={receptionForm.starts}
                      onChange={event =>
                        updateReceptionForm('starts', event.target.value)
                      }
                    >
                      <option>Sí</option>
                      <option>No</option>
                      <option>No se pudo verificar</option>
                    </select>
                  </label>

                  {conditionChecks.map(([field, label]) => (
                    <label className="check-card" key={field}>
                      <input
                        type="checkbox"
                        checked={receptionForm[field]}
                        onChange={event =>
                          updateReceptionForm(field, event.target.checked)
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <label className="inspection-notes">
                  Detalle de daños, fugas o piezas faltantes
                  <textarea
                    rows="3"
                    placeholder="Indica la zona y el detalle observado."
                    value={receptionForm.inspection_notes}
                    onChange={event =>
                      updateReceptionForm(
                        'inspection_notes',
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <label className="wide">
                Motivo del ingreso
                <textarea
                  required
                  rows="4"
                  placeholder="Describe el trabajo solicitado o la falla reportada por el cliente."
                  value={receptionForm.intake_notes}
                  onChange={event =>
                    updateReceptionForm(
                      'intake_notes',
                      event.target.value
                    )
                  }
                />
              </label>

              <div className="wide reception-media-section">
                <div className="media-section-heading">
                  <div><Camera size={23} /><div><h3>Fotografías de recepción</h3><p>Frente, lados, tablero y daños visibles.</p></div></div>
                  <label className="primary compact photo-input-button">
                    <Camera size={18} />Tomar o elegir fotos
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      multiple
                      onChange={addPhotos}
                    />
                  </label>
                </div>

                {photos.length ? (
                  <div className="reception-photo-grid">
                    {photos.map(photo => (
                      <article key={photo.id}>
                        <img src={photo.preview} alt="Vista previa de recepción" />
                        <select value={photo.photo_type} onChange={event => updatePhoto(photo.id, 'photo_type', event.target.value)}>
                          {photoTypes.map(type => <option key={type}>{type}</option>)}
                        </select>
                        <input placeholder="Descripción opcional" value={photo.caption} onChange={event => updatePhoto(photo.id, 'caption', event.target.value)} />
                        <label className="photo-visible"><input type="checkbox" checked={photo.client_visible} onChange={event => updatePhoto(photo.id, 'client_visible', event.target.checked)} />Visible para el cliente</label>
                        <button className="remove-photo" type="button" onClick={() => removePhoto(photo.id)}><Trash2 size={16} />Eliminar</button>
                      </article>
                    ))}
                  </div>
                ) : <div className="empty compact-empty">Todavía no se agregaron fotografías.</div>}
              </div>

              <div className="wide reception-media-section">
                <div className="media-section-heading">
                  <div><ClipboardCheck size={23} /><div><h3>Firma del cliente</h3><p>El cliente puede firmar con el dedo o el mouse.</p></div></div>
                </div>
                <label>
                  Nombre de quien firma
                  <input value={signerName} onChange={event => setSignerName(event.target.value)} />
                </label>
                <SignaturePad value={clientSignature} onChange={setClientSignature} />
              </div>

              <label className="wide">
                Observaciones internas
                <textarea
                  rows="3"
                  placeholder="Daños visibles, rayones, piezas faltantes u observaciones del taller."
                  value={receptionForm.internal_notes}
                  onChange={event =>
                    updateReceptionForm(
                      'internal_notes',
                      event.target.value
                    )
                  }
                />
              </label>

              <button
                className="primary"
                disabled={savingOrder}
              >
                {savingOrder
                  ? 'Creando orden...'
                  : 'Crear Orden de Trabajo'}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
