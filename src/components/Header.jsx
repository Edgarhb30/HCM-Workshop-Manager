import { LogOut, Menu } from 'lucide-react'
import Notifications from './Notifications'

const roleNames = {
  owner: 'Propietario',
  admin: 'Administrador',
  reception: 'Recepción',
  mechanic: 'Mecánico',
  viewer: 'Solo lectura'
}

export default function Header({
  title,
  email,
  userName,
  userId,
  workshop,
  role,
  logout,
  openMenu,
  onNavigate
}) {
  return (
    <header className="header">
      <button className="icon mobile-only" type="button" onClick={openMenu}>
        <Menu />
      </button>

      <div>
        <span className="eyebrow">
          {workshop?.name || 'HERRERA CUSTOM MOTORCYCLE'}
        </span>
        <h1>{title}</h1>
      </div>

      <div className="user">
        <Notifications userId={userId} workshopId={workshop?.id} onNavigate={onNavigate} />
        <div className="user-identity">
          <span>{userName || email}</span>
          {userName && <small>{email}</small>}
          <small>{roleNames[role] || role}</small>
        </div>
        <button className="icon" type="button" title="Cerrar sesión" onClick={logout}>
          <LogOut size={19} />
        </button>
      </div>
    </header>
  )
}
