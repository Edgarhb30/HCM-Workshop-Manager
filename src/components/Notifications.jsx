import { useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

const formatDate = value => new Intl.DateTimeFormat('es-CR', {
  dateStyle: 'short', timeStyle: 'short'
}).format(new Date(value))

export default function Notifications({ userId, workshopId, onNavigate }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)

  async function load() {
    if (!userId || !workshopId) return
    const { data } = await supabase.from('notifications').select('*')
      .eq('workshop_id', workshopId).eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(30)
    setItems(data || [])
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [userId, workshopId])

  async function markRead(item) {
    if (!item.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id)
      setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row))
    }
    if (item.link_type === 'work_order') onNavigate('ordenes')
    if (item.link_type === 'appointment') onNavigate('agenda')
    setOpen(false)
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('workshop_id', workshopId).eq('user_id', userId).is('read_at', null)
    load()
  }

  const unread = items.filter(item => !item.read_at).length

  return <div className="notifications">
    <button className="icon notification-trigger" type="button" title="Notificaciones" onClick={() => { setOpen(!open); if (!open) load() }}>
      <Bell size={20} />{unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="notification-panel">
      <div className="notification-heading"><strong>Notificaciones</strong>{unread > 0 && <button type="button" onClick={markAllRead}><CheckCheck size={16} />Marcar leídas</button>}</div>
      <div className="notification-list">
        {items.length ? items.map(item => <button type="button" className={!item.read_at ? 'unread' : ''} key={item.id} onClick={() => markRead(item)}>
          <strong>{item.title}</strong><span>{item.message}</span><small>{formatDate(item.created_at)}</small>
        </button>) : <p>Sin notificaciones.</p>}
      </div>
    </div>}
  </div>
}

