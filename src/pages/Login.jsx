import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const params = new URLSearchParams(window.location.search)
  const [activation,setActivation]=useState(params.get('invite') === '1');
  const [email,setEmail]=useState(params.get('email') || ''); const [password,setPassword]=useState('');
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false)
  const [notice,setNotice]=useState('')
  async function submit(e){e.preventDefault();setLoading(true);setError('');setNotice('');if(activation){const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)setError(error.message);else if(data.session)setNotice('Cuenta activada. Abriendo el taller…');else setNotice('Revisa tu correo y confirma la cuenta. Después podrás ingresar.')}else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError('Correo o contraseña incorrectos.')}setLoading(false)}
  return <main className="login-screen"><section className="login-card"><div className="login-logo"><img src="/hcm-logo.jpg" alt="Herrera Custom Motorcycle" /></div><span className="eyebrow">HERRERA CUSTOM MOTORCYCLE</span><h1>{activation?'Activar invitación':'Workshop Manager'}</h1><p>{activation?'Crea tu contraseña personal para entrar al taller.':'Acceso privado del taller'}</p><form onSubmit={submit}><label>Correo<input type="email" required readOnly={activation} value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" minLength="8" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="alert error">{error}</div>}{notice&&<div className="portal-notice">{notice}</div>}<button className="primary" disabled={loading}>{loading?(activation?'Activando…':'Entrando…'):(activation?'Crear cuenta':'Ingresar')}</button><button className="secondary" type="button" onClick={()=>{setActivation(!activation);setError('');setNotice('')}}>{activation?'Ya tengo cuenta':'Activar una invitación'}</button></form></section></main>
}
