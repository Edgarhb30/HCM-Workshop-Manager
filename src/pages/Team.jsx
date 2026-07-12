import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, Mail, ShieldCheck, UserPlus, UsersRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

const roleNames = {
  owner: 'Propietario', admin: 'Administrador', reception: 'Recepción',
  mechanic: 'Mecánico', viewer: 'Solo lectura'
}

export default function Team({ workshop, currentRole }) {
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastInvite, setLastInvite] = useState(null)
  const [form, setForm] = useState({ display_name: '', email: '', role: 'mechanic' })

  useEffect(() => { load() }, [workshop?.id])

  async function load() {
    if (!workshop?.id) return
    setLoading(true)
    const [membersResult, invitationsResult] = await Promise.all([
      supabase.from('workshop_members').select('*').eq('workshop_id', workshop.id).order('created_at'),
      supabase.from('workshop_invitations').select('*').eq('workshop_id', workshop.id).order('created_at', { ascending: false })
    ])
    if (membersResult.error) alert(membersResult.error.message)
    if (invitationsResult.error) alert(invitationsResult.error.message)
    setMembers(membersResult.data || [])
    setInvitations(invitationsResult.data || [])
    setLoading(false)
  }

  const activationLink = email => `${window.location.origin}/?invite=1&email=${encodeURIComponent(email)}`

  async function invite(event) {
    event.preventDefault()
    setSaving(true)
    const { error } = await supabase.rpc('invite_workshop_member', {
      p_workshop_id: workshop.id,
      p_email: form.email,
      p_display_name: form.display_name,
      p_role: form.role
    })
    setSaving(false)
    if (error) {
      alert(`No se pudo crear la invitación: ${error.message}`)
      return
    }
    setLastInvite({ email: form.email, link: activationLink(form.email) })
    setForm({ display_name: '', email: '', role: 'mechanic' })
    load()
  }

  async function copyInvite(invitation = lastInvite) {
    if (!invitation) return
    const link = invitation.link || activationLink(invitation.email)
    await navigator.clipboard.writeText(link)
    alert('Enlace de activación copiado.')
  }

  async function updateMember(member, role, active) {
    const { error } = await supabase.rpc('update_workshop_member_role', {
      p_member_id: member.id, p_role: role, p_active: active
    })
    if (error) return alert(error.message)
    load()
  }

  async function revokeInvitation(invitation) {
    const { error } = await supabase.from('workshop_invitations')
      .update({ status: 'Revocada', updated_at: new Date().toISOString() })
      .eq('id', invitation.id)
    if (error) return alert(error.message)
    load()
  }

  const activeMembers = useMemo(() => members.filter(item => item.active).length, [members])

  return <section className="panel team-page">
    <div className="panel-title"><div><span className="eyebrow">EQUIPO DEL TALLER</span><h2>Usuarios y permisos</h2><p className="muted">Cada persona tiene su propia cuenta y acceso según su función.</p></div><div className="team-count"><UsersRound size={20} /><strong>{activeMembers}</strong><span>activos</span></div></div>

    <form className="team-invite-form" onSubmit={invite}>
      <div className="team-form-title"><UserPlus size={21} /><div><strong>Invitar miembro</strong><span>La invitación vence en 7 días.</span></div></div>
      <label>Nombre<input required value={form.display_name} onChange={event => setForm({ ...form, display_name: event.target.value })} /></label>
      <label>Correo<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
      <label>Rol<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{currentRole === 'owner' && <option value="admin">Administrador</option>}<option value="reception">Recepción</option><option value="mechanic">Mecánico</option><option value="viewer">Solo lectura</option></select></label>
      <button className="primary" disabled={saving}>{saving ? 'Creando…' : 'Crear invitación'}</button>
    </form>

    {lastInvite && <div className="invite-success"><CheckCircle2 size={21} /><div><strong>Invitación preparada</strong><span>Envía el enlace a {lastInvite.email}.</span></div><button className="secondary compact" onClick={() => copyInvite()}><Copy size={17} />Copiar enlace</button></div>}

    <h3>Miembros</h3>
    {loading ? <div className="empty">Cargando equipo…</div> : <div className="team-list">{members.map(member => <article className={!member.active ? 'inactive' : ''} key={member.id}><div className="team-avatar">{(member.display_name || member.email || 'U').slice(0, 1).toUpperCase()}</div><div><strong>{member.display_name || 'Sin nombre'}</strong><span>{member.email || member.user_id}</span></div>{member.role === 'owner' ? <span className="team-owner"><ShieldCheck size={16} />Propietario</span> : <><select value={member.role} onChange={event => updateMember(member, event.target.value, member.active)}>{currentRole === 'owner' && <option value="admin">Administrador</option>}<option value="reception">Recepción</option><option value="mechanic">Mecánico</option><option value="viewer">Solo lectura</option></select><label className="team-active"><input type="checkbox" checked={member.active} onChange={event => updateMember(member, member.role, event.target.checked)} />Activo</label></>}</article>)}</div>}

    {!!invitations.filter(item => item.status === 'Pendiente').length && <><h3>Invitaciones pendientes</h3><div className="invitation-list">{invitations.filter(item => item.status === 'Pendiente').map(item => <article key={item.id}><Mail size={19} /><div><strong>{item.display_name || item.email}</strong><span>{item.email} · {roleNames[item.role]}</span></div><button className="secondary" onClick={() => copyInvite(item)}>Copiar enlace</button><button className="cancel-invoice" onClick={() => revokeInvitation(item)}>Revocar</button></article>)}</div></>}
  </section>
}
