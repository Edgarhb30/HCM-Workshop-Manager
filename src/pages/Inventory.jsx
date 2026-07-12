import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Eye,
  Package,
  Plus,
  Search,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const emptyProduct = {
  sku: '',
  name: '',
  category: 'Repuesto',
  unit: 'unidad',
  initial_stock: '',
  minimum_stock: 0,
  cost_price: '',
  sale_price: '',
  location: '',
  notes: ''
}

const emptyMovement = {
  movement_type: 'Entrada',
  quantity: '',
  work_order_id: '',
  unit_cost: '',
  reason: ''
}

const money = value =>
  new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

export default function Inventory({ role }) {
  const canManageProducts = ['owner', 'admin'].includes(role)
  const canRegisterMovements = ['owner', 'admin', 'mechanic'].includes(role)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [showForm, setShowForm] = useState(false)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [selected, setSelected] = useState(null)
  const [movements, setMovements] = useState([])
  const [movementForm, setMovementForm] = useState(emptyMovement)
  const [savingProduct, setSavingProduct] = useState(false)
  const [savingMovement, setSavingMovement] = useState(false)
  const [loadingMovements, setLoadingMovements] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [productsResult, ordersResult] = await Promise.all([
      supabase
        .from('inventory_products')
        .select('*')
        .eq('active', true)
        .order('name'),
      supabase
        .from('work_orders')
        .select('id, order_number, status, customer:customers(full_name), motorcycle:motorcycles(brand, model, plate)')
        .order('received_at', { ascending: false })
    ])

    if (productsResult.error) alert(productsResult.error.message)
    if (ordersResult.error) alert(ordersResult.error.message)
    setProducts(productsResult.data || [])
    setOrders(
      (ordersResult.data || []).filter(
        order => !['Entregada', 'Cancelada'].includes(order.status)
      )
    )
  }

  async function saveProduct(event) {
    event.preventDefault()
    setSavingProduct(true)

    const initialStock = Number(productForm.initial_stock || 0)
    const { data, error } = await supabase
      .from('inventory_products')
      .insert({
        sku: productForm.sku.trim().toUpperCase() || null,
        name: productForm.name.trim(),
        category: productForm.category,
        unit: productForm.unit.trim() || 'unidad',
        stock: 0,
        minimum_stock: Number(productForm.minimum_stock || 0),
        cost_price: Number(productForm.cost_price || 0),
        sale_price: Number(productForm.sale_price || 0),
        location: productForm.location.trim() || null,
        notes: productForm.notes.trim() || null
      })
      .select()
      .single()

    if (error) {
      setSavingProduct(false)
      alert(`No se pudo guardar el producto: ${error.message}`)
      return
    }

    if (initialStock > 0) {
      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          product_id: data.id,
          movement_type: 'Entrada',
          quantity: initialStock,
          unit_cost: Number(productForm.cost_price || 0),
          reason: 'Existencia inicial'
        })

      if (movementError) alert(movementError.message)
    }

    setSavingProduct(false)
    setProductForm(emptyProduct)
    setShowForm(false)
    load()
  }

  async function openProduct(product) {
    setSelected(product)
    setMovementForm({
      ...emptyMovement,
      unit_cost: product.cost_price || ''
    })
    setLoadingMovements(true)

    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*, work_order:work_orders(order_number)')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })

    if (error) alert(error.message)
    setMovements(data || [])
    setLoadingMovements(false)
  }

  async function saveMovement(event) {
    event.preventDefault()
    if (!selected) return
    setSavingMovement(true)

    const { data, error } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: selected.id,
        work_order_id: movementForm.work_order_id || null,
        movement_type: movementForm.movement_type,
        quantity: Number(movementForm.quantity),
        unit_cost:
          movementForm.movement_type === 'Entrada' && movementForm.unit_cost
            ? Number(movementForm.unit_cost)
            : null,
        reason: movementForm.reason.trim() || null
      })
      .select('*, work_order:work_orders(order_number)')
      .single()

    setSavingMovement(false)
    if (error) {
      alert(`No se pudo registrar el movimiento: ${error.message}`)
      return
    }

    const updatedProduct = {
      ...selected,
      stock: data.stock_after,
      cost_price:
        movementForm.movement_type === 'Entrada' && movementForm.unit_cost
          ? Number(movementForm.unit_cost)
          : selected.cost_price
    }

    setSelected(updatedProduct)
    setProducts(current =>
      current.map(product => product.id === updatedProduct.id ? updatedProduct : product)
    )
    setMovements(current => [data, ...current])
    setMovementForm({ ...emptyMovement, unit_cost: updatedProduct.cost_price || '' })
  }

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim()
    return products.filter(product => {
      const matchesCategory = category === 'Todas' || product.category === category
      const text = [product.sku, product.name, product.category, product.location]
        .filter(Boolean).join(' ').toLowerCase()
      return matchesCategory && text.includes(term)
    })
  }, [products, search, category])

  const summary = useMemo(() => ({
    products: products.length,
    lowStock: products.filter(product => Number(product.stock) <= Number(product.minimum_stock)).length,
    units: products.reduce((sum, product) => sum + Number(product.stock), 0),
    value: products.reduce((sum, product) => sum + Number(product.stock) * Number(product.cost_price), 0)
  }), [products])

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">INVENTARIO</span>
            <h2>Repuestos y consumibles</h2>
            <p className="muted">Control de existencias, costos, precios y movimientos por OT.</p>
          </div>
          {canManageProducts && <button className="primary compact" type="button" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'Cerrar' : 'Nuevo producto'}
          </button>}
        </div>

        <div className="inventory-summary">
          <article><Package size={21} /><span>Productos</span><strong>{summary.products}</strong></article>
          <article className={summary.lowStock ? 'warning' : ''}><AlertTriangle size={21} /><span>Stock bajo</span><strong>{summary.lowStock}</strong></article>
          <article><Boxes size={21} /><span>Existencias</span><strong>{summary.units.toLocaleString('es-CR')}</strong></article>
          <article><Package size={21} /><span>Valor al costo</span><strong>{money(summary.value)}</strong></article>
        </div>

        {canManageProducts && showForm && (
          <form className="inventory-form" onSubmit={saveProduct}>
            <label>Código / SKU<input value={productForm.sku} onChange={event => setProductForm({ ...productForm, sku: event.target.value })} /></label>
            <label>Nombre<input required value={productForm.name} onChange={event => setProductForm({ ...productForm, name: event.target.value })} /></label>
            <label>Categoría<select value={productForm.category} onChange={event => setProductForm({ ...productForm, category: event.target.value })}><option>Repuesto</option><option>Lubricante</option><option>Consumible</option><option>Otro</option></select></label>
            <label>Unidad<input placeholder="unidad, litro, metro..." value={productForm.unit} onChange={event => setProductForm({ ...productForm, unit: event.target.value })} /></label>
            <label>Existencia inicial<input type="number" min="0" step="0.01" value={productForm.initial_stock} onChange={event => setProductForm({ ...productForm, initial_stock: event.target.value })} /></label>
            <label>Stock mínimo<input type="number" min="0" step="0.01" value={productForm.minimum_stock} onChange={event => setProductForm({ ...productForm, minimum_stock: event.target.value })} /></label>
            <label>Costo unitario<input type="number" min="0" step="0.01" value={productForm.cost_price} onChange={event => setProductForm({ ...productForm, cost_price: event.target.value })} /></label>
            <label>Precio de venta<input type="number" min="0" step="0.01" value={productForm.sale_price} onChange={event => setProductForm({ ...productForm, sale_price: event.target.value })} /></label>
            <label>Ubicación<input placeholder="Ejemplo: Estante A2" value={productForm.location} onChange={event => setProductForm({ ...productForm, location: event.target.value })} /></label>
            <label className="wide">Notas<textarea value={productForm.notes} onChange={event => setProductForm({ ...productForm, notes: event.target.value })} /></label>
            <button className="primary" disabled={savingProduct}>{savingProduct ? 'Guardando...' : 'Guardar producto'}</button>
          </form>
        )}

        <div className="inventory-toolbar">
          <div className="search-box"><Search size={18} /><input type="search" placeholder="Buscar código, producto, categoría o ubicación" value={search} onChange={event => setSearch(event.target.value)} /></div>
          <select value={category} onChange={event => setCategory(event.target.value)}><option>Todas</option><option>Repuesto</option><option>Lubricante</option><option>Consumible</option><option>Otro</option></select>
        </div>

        <div className="inventory-list">
          {filteredProducts.map(product => {
            const low = Number(product.stock) <= Number(product.minimum_stock)
            return (
              <article className={`inventory-card ${low ? 'low-stock' : ''}`} key={product.id}>
                <div><span>{product.sku || product.category}</span><strong>{product.name}</strong><small>{product.location || 'Sin ubicación'}</small></div>
                <div className="inventory-stock"><span>Existencia</span><strong>{Number(product.stock).toLocaleString('es-CR')} {product.unit}</strong>{low && <small>Stock bajo</small>}</div>
                <div><span>Venta</span><strong>{money(product.sale_price)}</strong><small>Costo {money(product.cost_price)}</small></div>
                <button className="secondary compact" type="button" onClick={() => openProduct(product)}><Eye size={17} />Movimientos</button>
              </article>
            )
          })}
        </div>

        {!filteredProducts.length && <div className="empty">No hay productos que coincidan con la búsqueda.</div>}
      </section>

      {selected && (
        <div className="detail-backdrop" onClick={() => setSelected(null)}>
          <aside className="order-detail inventory-detail" onClick={event => event.stopPropagation()}>
            <button className="icon order-detail-close" type="button" onClick={() => setSelected(null)}><X size={20} /></button>
            <span className="eyebrow">MOVIMIENTOS DE INVENTARIO</span>
            <h2>{selected.name}</h2>
            <p className="muted">{selected.sku || selected.category} · {selected.location || 'Sin ubicación'}</p>

            <div className={`current-stock ${Number(selected.stock) <= Number(selected.minimum_stock) ? 'warning' : ''}`}>
              <Boxes size={27} /><div><span>Existencia actual</span><strong>{Number(selected.stock).toLocaleString('es-CR')} {selected.unit}</strong><small>Mínimo: {Number(selected.minimum_stock).toLocaleString('es-CR')}</small></div>
            </div>

            {canRegisterMovements && <form className="movement-form" onSubmit={saveMovement}>
              <h3>Registrar movimiento</h3>
              <label>Tipo<select value={movementForm.movement_type} onChange={event => setMovementForm({ ...movementForm, movement_type: event.target.value, work_order_id: event.target.value === 'Entrada' ? '' : movementForm.work_order_id })}><option>Entrada</option><option>Salida</option></select></label>
              <label>Cantidad<input required type="number" min="0.01" step="0.01" value={movementForm.quantity} onChange={event => setMovementForm({ ...movementForm, quantity: event.target.value })} /></label>
              {movementForm.movement_type === 'Entrada' && <label>Costo unitario<input type="number" min="0" step="0.01" value={movementForm.unit_cost} onChange={event => setMovementForm({ ...movementForm, unit_cost: event.target.value })} /></label>}
              {movementForm.movement_type === 'Salida' && <label className="wide">Orden de trabajo (opcional)<select value={movementForm.work_order_id} onChange={event => setMovementForm({ ...movementForm, work_order_id: event.target.value })}><option value="">Sin OT</option>{orders.map(order => <option key={order.id} value={order.id}>{order.order_number} · {order.customer?.full_name} · {order.motorcycle?.brand} {order.motorcycle?.model}</option>)}</select></label>}
              <label className="wide">Motivo / observación<textarea value={movementForm.reason} onChange={event => setMovementForm({ ...movementForm, reason: event.target.value })} /></label>
              <button className="primary" disabled={savingMovement}>{savingMovement ? 'Guardando...' : 'Registrar movimiento'}</button>
            </form>}

            <section className="record-section">
              <h3>Historial</h3>
              {loadingMovements ? <div className="empty">Cargando movimientos...</div> : movements.length ? (
                <div className="movement-history">
                  {movements.map(movement => (
                    <article key={movement.id}>
                      <div className={movement.movement_type === 'Entrada' ? 'movement-in' : 'movement-out'}>{movement.movement_type === 'Entrada' ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}</div>
                      <div><strong>{movement.movement_type}: {Number(movement.quantity).toLocaleString('es-CR')} {selected.unit}</strong><span>{new Date(movement.created_at).toLocaleString('es-CR')} · Stock {movement.stock_before} → {movement.stock_after}</span><small>{movement.work_order?.order_number || movement.reason || 'Sin referencia'}</small></div>
                    </article>
                  ))}
                </div>
              ) : <div className="empty compact-empty">No hay movimientos registrados.</div>}
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
