import { CalendarDays, ClipboardList, Gauge, Package, Settings, Users, Bike, FileText, BarChart3, X } from 'lucide-react'

const items = [
  ['dashboard','Dashboard',Gauge], ['agenda','Agenda',CalendarDays], ['clientes','Clientes',Users],
  ['motos','Motocicletas',Bike], ['ordenes','Órdenes de trabajo',ClipboardList],
  ['presupuestos','Presupuestos',FileText], ['inventario','Inventario',Package],
  ['reportes','Reportes',BarChart3], ['configuracion','Configuración',Settings]
]

export default function Sidebar({ page, setPage, open, close }) {
  return <aside className={`sidebar ${open ? 'open' : ''}`}>
    <div className="brand"><div className="brand-mark">HCM</div><div><strong>Herrera Custom</strong><span>Workshop Manager</span></div><button className="icon mobile-only" onClick={close}><X size={20}/></button></div>
    <nav>{items.map(([id,label,Icon]) => <button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);close()}}><Icon size={19}/><span>{label}</span></button>)}</nav>
    <div className="version">Versión 0.1</div>
  </aside>
}
