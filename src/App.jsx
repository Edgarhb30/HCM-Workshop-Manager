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
import Settings from './pages/Settings'
import ComingSoon from './pages/ComingSoon'
import PublicBooking from './pages/PublicBooking'
import ClientPortal from './pages/ClientPortal'
import Team from './pages/Team'
import { defaultBranding, themeVariables } from './lib/theme'

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
  ,equipo: 'Equipo y permisos'
}

export default function App() {
  const publicPath = window.location.pathname.replace(/\/$/, '') || '/'
  const invitationMode = new URLSearchParams(window.location.search).get('invite') === '1'
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [menu, setMenu] = useState(false)
  const [receptionAppointment, setReceptionAppointment] = useState(null)
  const [membership, setMembership] = useState(null)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [membershipError, setMembershipError] = useState('')
  const [branding, setBranding] = useState(defaultBranding)

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

      const membershipQuery = () => supabase
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

      let { data, error } = await membershipQuery()

      if (!error && !data) {
        const { data: accepted } = await supabase.rpc('accept_my_workshop_invitation')
        if (accepted) ({ data, error } = await membershipQuery())
      }

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

  useEffect(() => {
    if (!membership?.workshop?.id) return
    supabase
      .from('workshop_settings')
      .select('theme_mode, primary_color, accent_color, background_color, surface_color, text_color, logo_url, legal_name, tax_id, phone, email, address')
      .eq('workshop_id', membership.workshop.id)
      .single()
      .then(({ data }) => data && setBranding({ ...defaultBranding, ...data }))
  }, [membership?.workshop?.id])

  if (publicPath === '/reservar') {
    return <PublicBooking workshopSlug="herrera-custom-motorcycle" />
  }

  if (publicPath === '/mi-moto') {
    return <ClientPortal workshopSlug="herrera-custom-motorcycle" />
  }

  if (loading) {
    return <div className="boot">Cargando HCM…</div>
  }

  if (invitationMode && session) {
    return (
      <main className="login-screen">
        <section className="login-card invitation-session-warning">
          <div className="login-logo">HCM</div>
          <span className="eyebrow">ACTIVACIÓN DE EQUIPO</span>
          <h1>Ya hay una cuenta abierta</h1>
          <p>Actualmente está iniciada la sesión de <strong>{session.user.email}</strong>.</p>
          <p>Cierra esa sesión para activar la invitación con el correo nuevo.</p>
          <button className="primary" type="button" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión y continuar
          </button>
        </section>
      </main>
    )
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
        workshop={membership.workshop}
      />
    ),
    ordenes: <WorkOrders workshop={membership.workshop} branding={branding} />,
    presupuestos: <Quotes workshop={membership.workshop} branding={branding} />,
    facturas: <Invoices workshop={membership.workshop} branding={branding} />,
    inventario: <Inventory />,
    reportes: <Reports />,
    equipo: <Team workshop={membership.workshop} currentRole={membership.role} />,
    configuracion: (
      <Settings
        workshop={membership.workshop}
        role={membership.role}
        onWorkshopUpdated={workshop =>
          setMembership(current => ({ ...current, workshop }))
        }
        onBrandingUpdated={settings => setBranding(current => ({ ...current, ...settings }))}
      />
    )
  }

  const content =
    pages[page] || <ComingSoon title={titles[page]} />

  return (
    <div className={`app theme-${branding.theme_mode || 'light'}`} style={themeVariables(branding)}>
      <Sidebar
        page={page}
        setPage={setPage}
        open={menu}
        close={() => setMenu(false)}
        workshop={membership.workshop}
        branding={branding}
        role={membership.role}
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
