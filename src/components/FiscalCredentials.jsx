import { useState } from 'react'
import { KeyRound, LockKeyhole, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function FiscalCredentials({ role, configured, onConfigured }) {
  const canEdit = ['owner', 'admin'].includes(role)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [keyBase64, setKeyBase64] = useState('')
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)

  function selectKey(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.p12')) {
      event.target.value = ''
      return alert('Selecciona la llave criptográfica de Hacienda con extensión .p12')
    }
    const reader = new FileReader()
    reader.onload = () => {
      setKeyBase64(String(reader.result).split(',')[1] || '')
      setFileName(file.name)
    }
    reader.onerror = () => alert('No fue posible leer la llave seleccionada.')
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!username.trim() || !password || !pin || !keyBase64) return alert('Completa las credenciales y selecciona la llave .p12.')
    if (!confirm('HCM guardará estas credenciales cifradas. No será posible volver a verlas. ¿Continuar?')) return
    setSaving(true)
    const { error } = await supabase.rpc('save_my_fiscal_credentials', {
      p_api_username: username.trim(), p_api_password: password,
      p_signing_key_base64: keyBase64, p_signing_pin: pin
    })
    setSaving(false)
    if (error) return alert(`No se pudieron guardar las credenciales: ${error.message}`)
    setUsername(''); setPassword(''); setPin(''); setKeyBase64(''); setFileName('')
    onConfigured()
    alert('Credenciales fiscales cifradas correctamente.')
  }

  return (
    <div className="fiscal-credentials">
      <div className="fiscal-credentials-title"><LockKeyhole size={20} /><div><strong>Conexión segura con Hacienda</strong><span>{configured ? 'Credenciales y firma configuradas' : 'Pendiente de configurar'}</span></div></div>
      {configured && <p className="fiscal-configured"><KeyRound size={18} />La caja fuerte fiscal está lista. Solo reemplaza estos datos si Hacienda genera credenciales nuevas.</p>}
      {canEdit && <div className="settings-fields">
        <label>Usuario de API de Hacienda<input autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} /></label>
        <label>Contraseña de API<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>PIN de la llave .p12<input type="password" autoComplete="new-password" value={pin} onChange={event => setPin(event.target.value)} /></label>
        <label>Llave criptográfica .p12<span className="fiscal-file-input"><Upload size={17} />{fileName || 'Seleccionar archivo'}<input type="file" accept=".p12,application/x-pkcs12" onChange={selectKey} /></span></label>
        <button type="button" className="primary compact" disabled={saving} onClick={save}><LockKeyhole size={17} />{saving ? 'Cifrando…' : configured ? 'Reemplazar credenciales' : 'Guardar credenciales cifradas'}</button>
      </div>}
    </div>
  )
}
