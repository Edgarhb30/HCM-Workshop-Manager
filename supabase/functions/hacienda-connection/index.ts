import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function getServiceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const values = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
  return Object.values(values)[0] as string | undefined
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = getServiceKey()
    const authorization = req.headers.get('Authorization') || ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (!supabaseUrl || !serviceKey || !token) return json({ error: 'Falta autenticación del servidor' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: userResult, error: userError } = await admin.auth.getUser(token)
    if (userError || !userResult.user) return json({ error: 'Sesión inválida' }, 401)

    const { data: membership, error: membershipError } = await admin
      .from('workshop_members')
      .select('workshop_id, role, active')
      .eq('user_id', userResult.user.id)
      .eq('active', true)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle()
    if (membershipError || !membership) return json({ error: 'No tienes permiso para probar la conexión fiscal' }, 403)

    const { data: credentials, error: credentialsError } = await admin
      .rpc('get_fiscal_credentials_for_server', { p_workshop_id: membership.workshop_id })
      .single()
    if (credentialsError || !credentials) return json({ error: 'Las credenciales fiscales no están configuradas' }, 400)

    const body = new URLSearchParams({
      client_id: 'api-prod',
      client_secret: '',
      grant_type: 'password',
      username: credentials.api_username,
      password: credentials.api_password
    })

    const response = await fetch(
      'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
    )
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.access_token) {
      return json({ error: 'Hacienda rechazó el usuario o la contraseña de la API', detail: result.error_description || result.error || null }, 400)
    }

    if (result.refresh_token) {
      const logoutBody = new URLSearchParams({ client_id: 'api-prod', refresh_token: result.refresh_token })
      await fetch(
        'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/logout',
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: logoutBody }
      ).catch(() => undefined)
    }

    return json({ ok: true, message: 'Conexión con Hacienda verificada', expires_in: result.expires_in || null })
  } catch (_error) {
    return json({ error: 'No fue posible completar la prueba de conexión' }, 500)
  }
})

