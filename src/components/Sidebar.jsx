import {
  CalendarDays,
  ClipboardList,
  Gauge,
  Package,
  Settings,
  Users,
  UsersRound,
  Bike,
  FileText,
  Receipt,
  BarChart3,
  X,
  Inbox
} from 'lucide-react'
import { canAccessPage } from '../lib/permissions'

const items = [
  ['dashboard', 'Dashboard', Gauge],
  ['agenda', 'Agenda', CalendarDays],
  ['clientes', 'Clientes', Users],
  ['motos', 'Motocicletas', Bike],
  ['recepcion', 'Recepción', Inbox],
  ['ordenes', 'Órdenes de trabajo', ClipboardList],
  ['presupuestos', 'Presupuestos', FileText],
  ['facturas', 'Facturación', Receipt],
  ['inventario', 'Inventario', Package],
  ['reportes', 'Reportes', BarChart3],
  ['equipo', 'Equipo', UsersRound],
  ['configuracion', 'Configuración', Settings]
]

export default function Sidebar({
  page,
  setPage,
  open,
  close,
  workshop,
  branding,
  role
}) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">
          {branding?.logo_url ? <img src={branding.logo_url} alt={workshop?.name || 'Logo'} /> : 'HCM'}
        </div>

        <div>
          <strong>{workshop?.name || 'HCM Workshop'}</strong>
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
        {items.filter(([id]) => canAccessPage(role, id)).map(([id, label, Icon]) => (
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
        Versión 0.9 RC
      </div>
    </aside>
  )
}
