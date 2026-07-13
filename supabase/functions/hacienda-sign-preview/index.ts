import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const POLICY_URL = 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/Resoluci%C3%B3n_General_sobre_disposiciones_t%C3%A9cnicas_comprobantes_electr%C3%B3nicos_para_efectos_tributarios.pdf'
const POLICY_SHA256 = 'DWxin1xWOeI8OuWQXazh4VjLWAaCLAA954em7DMh0h8='

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function getServiceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const values = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
  return Object.values(values)[0] as string | undefined
}

function bytesFromBinary(binary: string) {
  const result = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index)
  return result
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = getServiceKey()
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!supabaseUrl || !serviceKey || !token) return json({ error: 'Falta autenticación del servidor' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: userResult, error: userError } = await admin.auth.getUser(token)
    if (userError || !userResult.user) return json({ error: 'Sesión inválida' }, 401)

    const { data: membership } = await admin.from('workshop_members')
      .select('workshop_id, role').eq('user_id', userResult.user.id).eq('active', true)
      .in('role', ['owner', 'admin']).limit(1).maybeSingle()
    if (!membership) return json({ error: 'Solo el propietario o administrador puede firmar comprobantes' }, 403)

    const { xml } = await req.json().catch(() => ({ xml: '' }))
    if (typeof xml !== 'string' || xml.length < 200 || !xml.includes('<TiqueteElectronico')) {
      return json({ error: 'El XML de prueba no es válido' }, 400)
    }

    const { data: credentials, error: credentialsError } = await admin
      .rpc('get_fiscal_credentials_for_server', { p_workshop_id: membership.workshop_id }).single()
    if (credentialsError || !credentials) return json({ error: 'Falta la llave criptográfica del taller' }, 400)

    const domModule = await import('npm:@xmldom/xmldom@0.8.10')
    Object.assign(globalThis, {
      DOMParser: domModule.DOMParser,
      XMLSerializer: domModule.XMLSerializer,
      DOMImplementation: domModule.DOMImplementation
    })
    const [{ default: forge }, xadesjs] = await Promise.all([
      import('npm:node-forge@1.3.1'),
      import('npm:xadesjs@2.6.7')
    ])
    xadesjs.Application.setEngine('HCM-Deno', crypto)

    const p12Der = forge.util.decode64(credentials.signing_key_base64)
    const p12Asn1 = forge.asn1.fromDer(p12Der)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, credentials.signing_pin)
    const keyOid = forge.pki.oids.pkcs8ShroudedKeyBag
    const plainKeyOid = forge.pki.oids.keyBag
    const keyBag = (p12.getBags({ bagType: keyOid })[keyOid] || p12.getBags({ bagType: plainKeyOid })[plainKeyOid] || [])[0]
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []
    if (!keyBag?.key || !certBags.length) return json({ error: 'La llave .p12 no contiene certificado y clave privada' }, 400)

    const privateKeyInfo = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keyBag.key))
    const privateDer = bytesFromBinary(forge.asn1.toDer(privateKeyInfo).getBytes())
    const privateKey = await crypto.subtle.importKey(
      'pkcs8', privateDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
    )
    const certificates = certBags.map(bag => forge.util.encode64(
      forge.asn1.toDer(forge.pki.certificateToAsn1(bag.cert)).getBytes()
    ))

    const document = xadesjs.Parse(xml)
    const signer = new xadesjs.SignedXml()
    await signer.Sign(
      { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
      privateKey,
      document,
      {
        x509: certificates,
        signingCertificate: certificates[0],
        references: [{ hash: 'SHA-256', transforms: ['enveloped', 'c14n'] }],
        policy: {
          identifier: { value: POLICY_URL, references: [POLICY_URL] },
          hash: 'SHA-256',
          digestValue: POLICY_SHA256,
          qualifiers: [POLICY_URL]
        }
      }
    )
    const signature = signer.GetXml()
    if (!signature) return json({ error: 'No se pudo construir la firma XAdES' }, 500)
    document.documentElement.appendChild(document.importNode(signature, true))
    const signedXml = new domModule.XMLSerializer().serializeToString(document)

    const verifier = new xadesjs.SignedXml(document)
    verifier.LoadXml(document.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0])
    const verified = await verifier.Verify()
    if (!verified) return json({ error: 'La firma fue creada, pero no superó la verificación interna' }, 500)

    return json({ ok: true, signed_xml: signedXml, verified: true, simulated: true })
  } catch (error) {
    return json({ error: 'No fue posible firmar el XML de prueba', detail: error instanceof Error ? error.message : null }, 500)
  }
})
