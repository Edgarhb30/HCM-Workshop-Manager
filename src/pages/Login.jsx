import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false)
  async function submit(e){e.preventDefault();setLoading(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError('Correo o contraseña incorrectos.');setLoading(false)}
  return <main className="login-screen"><section className="login-card"><div className="login-logo">HCM</div><span className="eyebrow">HERRERA CUSTOM MOTORCYCLE</span><h1>Workshop Manager</h1><p>Acceso privado del taller</p><form onSubmit={submit}><label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="alert error">{error}</div>}<button className="primary" disabled={loading}>{loading?'Entrando…':'Ingresar'}</button></form></section></main>
}
