import {
  CalendarDays,
  ClipboardList,
  Gauge,
  Package,
  Settings,
  Users,
  Bike,
  FileText,
  BarChart3,
  X,
  Inbox
} from 'lucide-react'

const items = [
  ['dashboard', 'Dashboard', Gauge],
  ['agenda', 'Agenda', CalendarDays],
  ['clientes', 'Clientes', Users],
  ['motos', 'Motocicletas', Bike],
  ['recepcion', 'Recepción', Inbox],
  ['ordenes', 'Órdenes de trabajo', ClipboardList],
  ['presupuestos', 'Presupuestos', FileText],
  ['inventario', 'Inventario', Package],
  ['reportes', 'Reportes', BarChart3],
  ['configuracion', 'Configuración', Settings]
]

export default function Sidebar({
  page,
  setPage,
  open,
  close
}) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">HCM</div>

        <div>
          <strong>Herrera Custom</strong>
          <span>Workshop Manager</span>
        </div>

        <button
          className="icon mobile-only"
          onClick={close}
          type="button"
        >
          <X size={20} />
        </button>
      </div>

      <nav>
        {items.map(([id, label, Icon]) => (
          <button
            key={id}
            className={page === id ? 'active' : ''}
            onClick={() => {
              setPage(id)
              close()
            }}
            type="button"
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="version">
        Versión 0.2
      </div>
    </aside>
  )
}