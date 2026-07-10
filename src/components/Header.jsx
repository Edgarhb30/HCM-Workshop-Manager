import { LogOut, Menu } from 'lucide-react'
export default function Header({ title, email, logout, openMenu }) {
  return <header className="header"><button className="icon mobile-only" onClick={openMenu}><Menu/></button><div><span className="eyebrow">HERRERA CUSTOM MOTORCYCLE</span><h1>{title}</h1></div><div className="user"><span>{email}</span><button className="icon" title="Cerrar sesión" onClick={logout}><LogOut size={19}/></button></div></header>
}
