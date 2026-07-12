import { useState } from 'react'
import { DatabaseBackup, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'

const tables = [
  'workshop_settings', 'appointment_services', 'schedule_blocks', 'appointments',
  'customers', 'motorcycles', 'work_orders', 'work_order_assignments',
  'work_order_events', 'work_order_photos', 'work_order_signatures',
  'work_order_deliveries', 'diagnostic_tests', 'oil_changes', 'maintenance_records',
  'quotes', 'quote_items', 'inventory_products', 'inventory_movements',
  'invoices', 'invoice_items', 'invoice_payments', 'notifications'
]

async function allRows(table, workshopId) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select('*')
      .eq('workshop_id', workshopId).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return rows
}

export default function DataBackup({ workshop }) {
  const [exporting, setExporting] = useState(false)

  async function downloadBackup() {
    setExporting(true)
    try {
      const backup = {
        format: 'HCM_WORKSHOP_BACKUP',
        version: 1,
        exported_at: new Date().toISOString(),
        workshop: { id: workshop.id, name: workshop.name, slug: workshop.slug },
        data: {}
      }
      for (const table of tables) backup.data[table] = await allRows(table, workshop.id)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `HCM-respaldo-${workshop.slug}-${new Date().toLocaleDateString('en-CA')}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(`No fue posible crear el respaldo: ${error.message}`)
    }
    setExporting(false)
  }

  return <section className="panel settings-section backup-section">
    <div className="settings-section-title"><DatabaseBackup size={22} /><div><h3>Copia de seguridad</h3><p>Descarga los registros del taller en un archivo fechado.</p></div></div>
    <div className="backup-explanation"><p>Incluye clientes, motos, citas, órdenes, diagnósticos, presupuestos, inventario, facturas y configuraciones.</p><p>Las contraseñas y claves privadas nunca se incluyen. Las fotos permanecen seguras en Supabase y se exportan sus referencias.</p></div>
    <button className="primary compact" type="button" disabled={exporting} onClick={downloadBackup}><Download size={18} />{exporting ? 'Preparando respaldo…' : 'Descargar copia ahora'}</button>
  </section>
}

