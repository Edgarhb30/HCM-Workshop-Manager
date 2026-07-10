import { useEffect, useState } from 'react'
import { CalendarDays, Bike, Clock3, CircleDollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'

const today = () => new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)
export default function Dashboard(){
 const [s,setS]=useState({today:0,bikes:0,waiting:0,income:0}); const [recent,setRecent]=useState([]); const [loading,setLoading]=useState(true)
 useEffect(()=>{load()},[])
 async function load(){setLoading(true); const [a,m]=await Promise.all([supabase.from('appointments').select('*').order('appointment_date').order('appointment_time'),supabase.from('motorcycles').select('id',{count:'exact',head:true})]); const rows=a.data||[]; setS({today:rows.filter(x=>x.appointment_date===today()&&x.status!=='Cancelada').length,bikes:m.count||0,waiting:0,income:0});setRecent(rows.filter(x=>x.appointment_date>=today()).slice(0,5));setLoading(false)}
 const cards=[['Citas de hoy',s.today,CalendarDays],['Motocicletas registradas',s.bikes,Bike],['Esperando repuestos',s.waiting,Clock3],['Ingresos del día',`₡${s.income.toLocaleString('es-CR')}`,CircleDollarSign]]
 return <><div className="stats-grid">{cards.map(([t,v,I])=><article className="stat-card" key={t}><div><span>{t}</span><strong>{loading?'—':v}</strong></div><I/></article>)}</div><section className="panel"><div className="panel-title"><div><span className="eyebrow">PRÓXIMOS TRABAJOS</span><h2>Agenda próxima</h2></div><button className="secondary" onClick={load}>Actualizar</button></div>{recent.length?<div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Moto</th><th>Servicio</th><th>Estado</th></tr></thead><tbody>{recent.map(a=><tr key={a.id}><td>{a.appointment_date}</td><td>{String(a.appointment_time).slice(0,5)}</td><td>{a.customer_name}</td><td>{a.brand} {a.model}</td><td>{a.service}</td><td><span className={`pill ${a.status.toLowerCase()}`}>{a.status}</span></td></tr>)}</tbody></table></div>:<div className="empty">No hay citas próximas.</div>}</section></>
}
