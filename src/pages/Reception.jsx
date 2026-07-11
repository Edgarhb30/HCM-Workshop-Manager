import { useEffect, useMemo, useState } from 'react'
import {
  UserRound,
  Bike,
  Search,
  ArrowRight,
  CheckCircle2,
  Plus,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'

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

export default function Reception() {
  const [customers, setCustomers] = useState([])
  const [motorcycles, setMotorcycles] = useState([])

  const [customerSearch, setCustomerSearch] = useState('')
  const [motorcycleSearch, setMotorcycleSearch] = useState('')

  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedMotorcycle, setSelectedMotorcycle] = useState(null)

  const [showMotorcycleForm, setShowMotorcycleForm] = useState(false)
  const [motorcycleForm, setMotorcycleForm] = useState(
    emptyMotorcycleForm
  )

  const [loading, setLoading] = useState(true)
  const [savingMotorcycle, setSavingMotorcycle] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

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
    setMotorcycleSearch('')
    setShowMotorcycleForm(false)
    setMotorcycleForm(emptyMotorcycleForm)
  }

  function restart() {
    setSelectedCustomer(null)
    setSelectedMotorcycle(null)
    setCustomerSearch('')
    setMotorcycleSearch('')
    setShowMotorcycleForm(false)
    setMotorcycleForm(emptyMotorcycleForm)
  }

  function updateMotorcycleForm(field, value) {
    setMotorcycleForm(current => ({
      ...current,
      [field]: value
    }))
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
    setSelectedMotorcycle(data)
    setShowMotorcycleForm(false)
    setMotorcycleForm(emptyMotorcycleForm)
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
                : 'Preparar recepción'}
          </h2>

          <p>
            Selecciona el cliente y la motocicleta para crear una
            orden de trabajo.
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

          {!loading && !filteredCustomers.length && (
            <div className="empty">
              No encontramos clientes con esa búsqueda.
            </div>
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
                onClick={() =>
                  setSelectedMotorcycle(motorcycle)
                }
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

          {!customerMotorcycles.length && (
            <div className="empty">
              Este cliente todavía no tiene motocicletas registradas.
            </div>
          )}

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

          <div className="reception-ready">
            <Bike size={34} />

            <h3>Listos para continuar</h3>

            <p>
              El siguiente paso registrará kilometraje, combustible,
              llaves, accesorios y motivo de ingreso.
            </p>

            <button
              type="button"
              className="primary"
              onClick={() =>
                alert(
                  'El formulario de ingreso será el siguiente paso.'
                )
              }
            >
              Continuar con la recepción
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}