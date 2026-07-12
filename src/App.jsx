import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import Sidebar from './components/Sidebar'
import Header from './components/Header'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Agenda from './pages/Agenda'
import Customers from './pages/Customers'
import Motorcycles from './pages/Motorcycles'
import Reception from './pages/Reception'
import WorkOrders from './pages/WorkOrders'
import Quotes from './pages/Quotes'
import Inventory from './pages/Inventory'
import Invoices from './pages/Invoices'
import Reports from './pages/Reports'
import ComingSoon from './pages/ComingSoon'

const titles = {
  dashboard: 'Dashboard',
  agenda: 'Agenda',
  clientes: 'Clientes',
  motos: 'Motocicletas',
  recepcion: 'Recepción de motocicletas',
  ordenes: 'Órdenes de trabajo',
  presupuestos: 'Presupuestos',
  facturas: 'Facturación',
  inventario: 'Inventario',
  reportes: 'Reportes',
  configuracion: 'Configuración'
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [menu, setMenu] = useState(false)
  const [receptionAppointment, setReceptionAppointment] = useState(null)
  const [membership, setMembership] = useState(null)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [membershipError, setMembershipError] = useState('')

  function receiveAppointment(appointment) {
    setReceptionAppointment(appointment)
    setPage('recepcion')
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user?.id) {
      setMembership(null)
      setMembershipError('')
      return
    }

    async function loadMembership() {
      setMembershipLoading(true)
      setMembershipError('')

      const { data, error } = await supabase
        .from('workshop_members')
        .select(`
          role,
          active,
          workshop:workshops(id, name, slug, timezone, currency, active)
        `)
        .eq('user_id', session.user.id)
        .eq('active', true)
        .limit(1)
        .maybeSingle()

      if (error) {
        setMembershipError(error.message)
      } else if (!data?.workshop?.active) {
        setMembershipError('Tu usuario no tiene acceso a un taller activo.')
      } else {
        setMembership(data)
      }

      setMembershipLoading(false)
    }

    loadMembership()
  }, [session?.user?.id])

  if (loading) {
    return <div className="boot">Cargando HCM…</div>
  }

  if (!session) {
    return <Login />
  }

  if (membershipLoading || !membership && !membershipError) {
    return <div className="boot">Cargando taller y permisos…</div>
  }

  if (membershipError) {
    return (
      <div className="access-denied">
        <span className="eyebrow">ACCESO AL TALLER</span>
        <h1>No fue posible abrir HCM Workshop Manager</h1>
        <p>{membershipError}</p>
        <button className="primary" type="button" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    )
  }

  const pages = {
    dashboard: <Dashboard />,
    agenda: <Agenda onReceive={receiveAppointment} />,
    clientes: <Customers />,
    motos: <Motorcycles />,
    recepcion: (
      <Reception
        initialAppointment={receptionAppointment}
        clearInitialAppointment={() => setReceptionAppointment(null)}
      />
    ),
    ordenes: <WorkOrders />,
    presupuestos: <Quotes />,
    facturas: <Invoices />,
    inventario: <Inventory />,
    reportes: <Reports />
  }

  const content =
    pages[page] || <ComingSoon title={titles[page]} />

  return (
    <div className="app">
      <Sidebar
        page={page}
        setPage={setPage}
        open={menu}
        close={() => setMenu(false)}
      />

      {menu && (
        <div
          className="overlay"
          onClick={() => setMenu(false)}
        />
      )}

      <div className="workspace">
        <Header
          title={titles[page]}
          email={session.user.email}
          workshop={membership.workshop}
          role={membership.role}
          openMenu={() => setMenu(true)}
          logout={() => supabase.auth.signOut()}
        />

        <main className="content">
          {content}
        </main>
      </div>
    </div>
  )
}
