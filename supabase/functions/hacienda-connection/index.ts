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
    const requestBody = await req.json().catch(() => ({}))
    const action = requestBody?.action || 'test'
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
      .in('role', ['preview', 'cabys_search'].includes(action) ? ['owner', 'admin', 'reception'] : ['owner', 'admin'])
      .limit(1)
      .maybeSingle()
    if (membershipError || !membership) return json({ error: 'No tienes permiso para realizar esta operación fiscal' }, 403)

    if (action === 'cabys_search') {
      const query = String(requestBody?.query || '').trim()
      if (query.length < 3) return json({ error: 'Escribe al menos tres letras para buscar' }, 400)
      const response = await fetch(`https://api.hacienda.go.cr/fe/cabys?q=${encodeURIComponent(query)}&top=12`)
      const result = await response.json().catch(() => ({}))
      if (!response.ok) return json({ error: 'El catálogo oficial CABYS no respondió' }, 502)
      return json({
        ok: true,
        results: (result.cabys || []).map((item: Record<string, unknown>) => ({
          code: item.codigo,
          description: item.descripcion,
          tax_rate: Number(item.impuesto || 0),
          category: Array.isArray(item.categorias) ? item.categorias.at(-2) || item.categorias.at(-1) || '' : ''
        }))
      })
    }

    if (action === 'preview') {
      const invoiceId = String(requestBody?.invoice_id || '')
      const documentType = String(requestBody?.document_type || '')
      if (!invoiceId || !['01', '04'].includes(documentType)) {
        return json({ error: 'Selecciona una factura y un tipo de comprobante válido' }, 400)
      }

      const [{ data: invoice, error: invoiceError }, { data: settings, error: settingsError }] = await Promise.all([
        admin
          .from('invoices')
          .select('id, invoice_number, status, subtotal, discount, tax_rate, tax_amount, total, amount_paid, issued_at, work_order_id')
          .eq('id', invoiceId)
          .eq('workshop_id', membership.workshop_id)
          .maybeSingle(),
        admin
          .from('fiscal_settings')
          .select('*')
          .eq('workshop_id', membership.workshop_id)
          .maybeSingle()
      ])
      if (invoiceError || !invoice) return json({ error: 'Factura interna no encontrada' }, 404)
      if (settingsError || !settings) return json({ error: 'Falta configurar los datos fiscales del taller' }, 400)

      const [{ data: items, error: itemsError }, { data: order, error: orderError }] = await Promise.all([
        admin
          .from('invoice_items')
          .select('id, item_type, description, quantity, unit_price, line_total, cabys_code, unit_code, tax_code, tax_rate_code, fiscal_tax_rate')
          .eq('invoice_id', invoice.id)
          .eq('workshop_id', membership.workshop_id)
          .order('created_at'),
        admin
          .from('work_orders')
          .select('id, customer_id')
          .eq('id', invoice.work_order_id)
          .eq('workshop_id', membership.workshop_id)
          .maybeSingle()
      ])
      if (itemsError || orderError || !order) return json({ error: 'No fue posible cargar el detalle de la factura' }, 400)

      let customer = null
      if (order.customer_id) {
        const result = await admin
          .from('customers')
          .select('full_name, phone, email, fiscal_identification_type, fiscal_identification_number, fiscal_economic_activity_code')
          .eq('id', order.customer_id)
          .eq('workshop_id', membership.workshop_id)
          .maybeSingle()
        customer = result.data
      }

      const missing: string[] = []
      if (!settings.issuer_name) missing.push('Nombre o razón social del emisor')
      if (!settings.identification_number) missing.push('Identificación del emisor')
      if (!/^\d{6}$/.test(settings.economic_activity_code || '')) missing.push('Actividad económica del emisor (6 dígitos)')
      if (!settings.credentials_configured || !settings.signing_key_configured) missing.push('Credenciales y llave de firma')
      if (!items?.length) missing.push('Al menos una línea de detalle')
      for (const [index, item] of (items || []).entries()) {
        if (!/^\d{13}$/.test(item.cabys_code || '')) missing.push(`CABYS de la línea ${index + 1}: ${item.description}`)
        if (!item.unit_code) missing.push(`Unidad de medida de la línea ${index + 1}`)
      }
      if (documentType === '01') {
        if (!customer?.full_name) missing.push('Nombre del receptor')
        if (!customer?.fiscal_identification_type) missing.push('Tipo de identificación del receptor')
        if (!/^\d{9,12}$/.test(customer?.fiscal_identification_number || '')) missing.push('Número de identificación del receptor')
        if (!customer?.email) missing.push('Correo del receptor')
      }

      return json({
        ok: true,
        ready: missing.length === 0,
        document_type: documentType,
        document_name: documentType === '01' ? 'Factura electrónica' : 'Tiquete electrónico',
        invoice_number: invoice.invoice_number,
        customer_name: customer?.full_name || 'Consumidor final',
        total: invoice.total,
        line_count: items?.length || 0,
        missing,
        message: missing.length ? 'El borrador necesita completar algunos datos' : 'El comprobante está listo para generar el XML de prueba'
      })
    }

    if (action !== 'test') return json({ error: 'Operación no reconocida' }, 400)

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
