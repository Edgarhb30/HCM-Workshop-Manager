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
import ComingSoon from './pages/ComingSoon'

const titles = {
  dashboard: 'Dashboard',
  agenda: 'Agenda',
  clientes: 'Clientes',
  motos: 'Motocicletas',
  recepcion: 'Recepción de motocicletas',
  ordenes: 'Órdenes de trabajo',
  presupuestos: 'Presupuestos',
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

  if (loading) {
    return <div className="boot">Cargando HCM…</div>
  }

  if (!session) {
    return <Login />
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
    presupuestos: <Quotes />
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
