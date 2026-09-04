import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }
function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (legacy) return legacy
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS'); if (raw) return JSON.parse(raw).default as string
  throw new Error('Chave de serviço do Supabase não disponível.')
}
function phone(value: unknown) {
  const raw = String(value ?? '').trim(); if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (!raw.startsWith('+') && !digits.startsWith('55') && [10, 11].includes(digits.length)) digits = `55${digits}`
  if (digits.length < 8 || digits.length > 15) return null
  return `+${digits}`
}
function normalizeCode(value: unknown) { return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') }
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
const url = Deno.env.get('SUPABASE_URL')!
const admin = createClient(url, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })
async function ensureSafePassword(password: string) {
  const response = await fetch(`${url}/functions/v1/password-security`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey(),
    },
    body: JSON.stringify({ password }),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || result?.ok !== true) {
    throw new Error(
      result?.error ||
      'Não foi possível validar a segurança da senha agora.'
    )
  }
}
async function findUserByEmail(email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const found = data.users.find(u => String(u.email || '').toLowerCase() === email)
    if (found) return found
    if (data.users.length < 100) return null
  }
  throw new Error('Limite de busca de usuários atingido.')
}
async function ensureProfile(userId: string, patch: Record<string, unknown>) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await admin.from('profiles').update(patch).eq('id', userId).select('id,role,active,approval_status').maybeSingle()
    if (error) throw error
    if (data) return data
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error('O perfil da conta ainda não ficou disponível. Gere um novo convite e tente novamente.')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let claimedInviteId: string | null = null, claimedEmail = '', releaseClaim = true
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const displayName = String(body.display_name || '').trim()
    const whatsapp = phone(body.whatsapp_number)
    const code = normalizeCode(body.invite_code)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um endereço de e-mail válido.')
    if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.')
    if (!displayName) throw new Error('Informe seu nome completo.')
    if (!whatsapp) throw new Error('Informe um telefone/WhatsApp válido com DDD.')
    if (code.length !== 16) throw new Error('Código de convite inválido.')
    await ensureSafePassword(password)
    const codeHash = await sha256Hex(code), now = new Date().toISOString()
    const { data: invite, error: inviteError } = await admin.from('signup_invites').select('*').eq('code_hash', codeHash).maybeSingle()
    if (inviteError) throw inviteError
    if (!invite || invite.revoked_at || invite.used_at || new Date(invite.expires_at).getTime() <= Date.now()) throw new Error('Código de convite inválido, expirado ou já utilizado.')
    const { data: claimed, error: claimError } = await admin.from('signup_invites').update({ used_at: now, used_email: email }).eq('id', invite.id).is('used_at', null).is('revoked_at', null).gt('expires_at', now).select('id').maybeSingle()
    if (claimError) throw claimError
    if (!claimed) throw new Error('Este código acabou de ser utilizado ou expirou. Solicite um novo convite.')
    claimedInviteId = invite.id; claimedEmail = email

    let user = await findUserByEmail(email)
    if (user) {
      const { data: profile } = await admin.from('profiles').select('role,active,approval_status').eq('id', user.id).maybeSingle()
      if (profile?.approval_status === 'approved' && profile?.active) throw new Error('Já existe uma conta ativa para este e-mail. Use a tela de Login.')
      const { data, error } = await admin.auth.admin.updateUserById(user.id, {
        password, email_confirm: true,
        user_metadata: { ...(user.user_metadata || {}), display_name: displayName, requested_role: 'field', central_self_signup: true, signup_via_invite: true, whatsapp_number: whatsapp, push_notifications_enabled: true },
      })
      if (error || !data.user) throw error || new Error('Não foi possível confirmar a conta existente.')
      user = data.user
      releaseClaim = false
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { display_name: displayName, requested_role: 'field', central_self_signup: true, signup_via_invite: true, whatsapp_number: whatsapp, push_notifications_enabled: true },
      })
      if (error || !data.user) throw error || new Error('Não foi possível criar a conta.')
      user = data.user
      releaseClaim = false
    }
    await ensureProfile(user.id, {
      display_name: displayName, role: 'field', requested_role: 'field', active: true,
      approval_status: 'approved', approved_at: now, approved_by: null, whatsapp_number: whatsapp,
      push_notifications_enabled: true, notify_report_received: true, notify_report_approved: true, notify_report_rejected: true,
    })
    const { error: usedError } = await admin.from('signup_invites').update({ used_by: user.id }).eq('id', invite.id).eq('used_email', email)
    if (usedError) throw usedError
    return json({ ok: true })
  } catch (error) {
    if (releaseClaim && claimedInviteId && claimedEmail) {
      try { await admin.from('signup_invites').update({ used_at: null, used_email: null }).eq('id', claimedInviteId).eq('used_email', claimedEmail).is('used_by', null) } catch {}
    }
    return json({ error: error instanceof Error ? error.message : String(error) }, 400)
  }
})
