import { LogOut, Menu } from 'lucide-react'

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
  workshop,
  role,
  logout,
  openMenu
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
        <div className="user-identity">
          <span>{email}</span>
          <small>{roleNames[role] || role}</small>
        </div>
        <button className="icon" type="button" title="Cerrar sesión" onClick={logout}>
          <LogOut size={19} />
        </button>
      </div>
    </header>
  )
}
