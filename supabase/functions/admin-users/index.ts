import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (raw) return JSON.parse(raw).default as string
  throw new Error('Chave de serviço do Supabase não disponível.')
}
function phone(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (!raw.startsWith('+') && !digits.startsWith('55') && [10, 11].includes(digits.length)) digits = `55${digits}`
  if (digits.length < 8 || digits.length > 15) throw new Error('Telefone/WhatsApp inválido. Use o padrão +55 DDD número.')
  return `+${digits}`
}
function bool(v: unknown, fallback = true) { return typeof v === 'boolean' ? v : fallback }


function normalizeInviteCode(value: unknown) { return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') }
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const raw = Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
  return raw.match(/.{1,4}/g)!.join('-')
}

const url = Deno.env.get('SUPABASE_URL')!
const admin = createClient(url, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })

async function caller(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) throw new Error('Sessão não informada.')
  const { data: authData, error: authError } = await admin.auth.getUser(jwt)
  if (authError || !authData.user) throw new Error('Sessão inválida.')
  const { data: profile, error } = await admin.from('profiles').select('*').eq('id', authData.user.id).single()
  if (error || !profile || profile.role !== 'admin' || !profile.active || (profile.approval_status && profile.approval_status !== 'approved')) {
    throw new Error('A gestão de usuários é exclusiva da Equipe Administrativa.')
  }
  return { user: authData.user, profile }
}

async function audit(actor: any, target: any, action: string, label: string, details = '') {
  await admin.from('user_admin_audit').insert({
    actor_id: actor.user.id,
    actor_name: actor.profile.display_name || actor.user.email,
    target_id: target?.id || null,
    target_name: target?.display_name || null,
    target_email: target?.email || null,
    action, action_label: label, details,
  })
}

async function authUsers() {
  const all: any[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    all.push(...data.users)
    if (data.users.length < 100) break
  }
  return all
}

async function listData() {
  const [users, profilesRes, auditRes, logsRes, pushSubsRes, invitesRes] = await Promise.all([
    authUsers(),
    admin.from('profiles').select('*'),
    admin.from('user_admin_audit').select('*').order('created_at', { ascending: false }).limit(30),
    admin.from('notification_outbox').select('*').order('created_at', { ascending: false }).limit(60),
    admin.from('push_subscriptions').select('user_id,active'),
    admin.from('signup_invites').select('id,code_hint,note,created_at,expires_at,used_at,used_email,revoked_at').order('created_at', { ascending: false }).limit(30),
  ])
  if (profilesRes.error) throw profilesRes.error
  if (pushSubsRes.error) throw pushSubsRes.error
  if (invitesRes.error) throw invitesRes.error
  const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]))
  const normalizedUsers = users.map(u => {
    const p: any = profileMap.get(u.id) || {}
    return {
      id: u.id, email: u.email, display_name: p.display_name || u.user_metadata?.display_name || u.email,
      role: p.role || 'field', requested_role: p.requested_role || u.user_metadata?.requested_role || 'field',
      active: p.active ?? false, approval_status: p.approval_status || 'pending', must_change_password: p.must_change_password ?? false,
      last_sign_in_at: u.last_sign_in_at, created_at: u.created_at,
      whatsapp_number: p.whatsapp_number || u.user_metadata?.whatsapp_number || null,
      push_notifications_enabled: p.push_notifications_enabled ?? true,
      notify_new_reports: p.notify_new_reports ?? true,
      notify_report_received: p.notify_report_received ?? true,
      notify_report_approved: p.notify_report_approved ?? true,
      notify_report_rejected: p.notify_report_rejected ?? true,
      notify_report_corrected: p.notify_report_corrected ?? true,
    }
  })
  const pushDeviceCounts = (pushSubsRes.data || []).filter((x: any) => x.active).reduce((acc: Record<string, number>, x: any) => { acc[x.user_id] = (acc[x.user_id] || 0) + 1; return acc }, {})
  normalizedUsers.forEach((u: any) => { u.push_device_count = pushDeviceCounts[u.id] || 0 })
  const nameMap = new Map(normalizedUsers.map(u => [u.id, u.display_name]))
  const logs = (logsRes.data || []).map((x: any) => ({ ...x, recipient_name: nameMap.get(x.recipient_user_id) || 'Usuário' }))
  const summary = logs.reduce((acc: Record<string, number>, x: any) => { acc[x.status] = (acc[x.status] || 0) + 1; return acc }, {})
  return { users: normalizedUsers, audit: auditRes.data || [], notification_logs: logs, notification_summary: summary, invites: invitesRes.data || [], push_configured: Boolean(Deno.env.get('VAPID_PUBLIC_KEY') && Deno.env.get('VAPID_PRIVATE_KEY') && Deno.env.get('VAPID_SUBJECT')) }
}

async function protectLastAdmin(targetId: string, nextRole: string, nextActive: boolean, actorId: string) {
  if (targetId === actorId && (nextRole !== 'admin' || !nextActive)) throw new Error('Você não pode remover o próprio acesso administrativo.')
  const { data: target } = await admin.from('profiles').select('role,active,approval_status').eq('id', targetId).single()
  if (target?.role === 'admin' && target?.active && (nextRole !== 'admin' || !nextActive)) {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true).eq('approval_status', 'approved')
    if ((count || 0) <= 1) throw new Error('O último administrador ativo não pode ser desativado ou rebaixado.')
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const actor = await caller(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'list') return json(await listData())

    if (action === 'create_invite') {
      const hours = Math.max(1, Math.min(168, Number(body.expires_hours || 24)))
      const note = String(body.note || '').trim().slice(0, 120) || null
      let code = '', normalized = '', codeHash = ''
      for (let attempt = 0; attempt < 4; attempt++) {
        code = generateInviteCode(); normalized = normalizeInviteCode(code); codeHash = await sha256Hex(normalized)
        const { error } = await admin.from('signup_invites').insert({
          code_hash: codeHash, code_hint: normalized.slice(-4), note, created_by: actor.user.id,
          expires_at: new Date(Date.now() + hours * 3600000).toISOString(),
        })
        if (!error) break
        if (attempt === 3) throw error
      }
      const { data: created, error: fetchError } = await admin.from('signup_invites').select('id,expires_at').eq('code_hash', codeHash).single()
      if (fetchError) throw fetchError
      await audit(actor, null, 'create_invite', 'Código de convite criado', `${hours}h${note ? ` · ${note}` : ''}`)
      return json({ invite: { id: created.id, code, expires_at: created.expires_at } })
    }

    if (action === 'revoke_invite') {
      const inviteId = String(body.invite_id || '')
      if (!inviteId) throw new Error('Convite não informado.')
      const { data: updated, error } = await admin.from('signup_invites').update({ revoked_at: new Date().toISOString() }).eq('id', inviteId).is('used_at', null).is('revoked_at', null).select('id,code_hint').maybeSingle()
      if (error) throw error
      if (!updated) throw new Error('Este convite não está mais ativo.')
      await audit(actor, null, 'revoke_invite', 'Código de convite revogado', `Final ••••${updated.code_hint || ''}`)
      return json({ ok: true })
    }

    if (action === 'retry_notification') {
      const notificationId = String(body.notification_id || '')
      if (!notificationId) throw new Error('Notificação não informada.')
      const { data: notification, error: notificationError } = await admin.from('notification_outbox').select('*').eq('id', notificationId).single()
      if (notificationError) throw notificationError
      if (!['failed', 'queued'].includes(notification.status)) throw new Error('Somente notificações na fila ou com falha podem ser reenviadas.')
      if (Number(notification.attempts || 0) >= 5) throw new Error('Esta notificação atingiu o limite de 5 tentativas. Revise a configuração antes de tentar novamente.')
      const webhookSecret = Deno.env.get('CENTRAL_WEBHOOK_SECRET')?.trim()
      if (!webhookSecret) throw new Error('Secret CENTRAL_WEBHOOK_SECRET não configurado.')
      const { error: queueError } = await admin.from('notification_outbox').update({ status: 'queued', last_error: null }).eq('id', notificationId)
      if (queueError) throw queueError
      const dispatchResponse = await fetch(`${url}/functions/v1/push-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-central-webhook-secret': webhookSecret },
        body: JSON.stringify({ outbox_id: notificationId }),
      })
      const dispatchResult = await dispatchResponse.json().catch(() => ({}))
      if (!dispatchResponse.ok) throw new Error(dispatchResult?.error || 'Falha ao reenviar a notificação.')
      await audit(actor, { id: notification.recipient_user_id, display_name: 'Destinatário Push', email: '' }, 'retry_notification', 'Notificação reenviada', `${notification.event_type} · tentativa ${Number(notification.attempts || 0) + 1}`)
      return json({ ok: true, dispatch: dispatchResult })
    }

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um endereço de e-mail válido.')
      if (String(body.password || '').length < 8) throw new Error('A senha temporária deve ter pelo menos 8 caracteres.')
      const whatsapp = phone(body.whatsapp_number)
      if (!whatsapp) throw new Error('Informe o telefone/WhatsApp de contato do usuário.')
      const role = body.role === 'admin' ? 'admin' : 'field'
      const active = body.active !== false
      const { data, error } = await admin.auth.admin.createUser({
        email, password: String(body.password), email_confirm: true,
        user_metadata: { display_name: String(body.display_name || '').trim(), requested_role: role, whatsapp_number: whatsapp },
      })
      if (error) throw error
      if (!data.user) throw new Error('Usuário não criado.')
      const patch = {
        display_name: String(body.display_name || '').trim(), role, requested_role: role, active,
        approval_status: 'approved', approved_at: new Date().toISOString(), approved_by: actor.user.id,
        must_change_password: true, whatsapp_number: whatsapp,
        push_notifications_enabled: bool(body.push_notifications_enabled),
        notify_new_reports: bool(body.notify_new_reports), notify_report_received: bool(body.notify_report_received),
        notify_report_approved: bool(body.notify_report_approved), notify_report_rejected: bool(body.notify_report_rejected),
        notify_report_corrected: bool(body.notify_report_corrected),
      }
      const { error: profileError } = await admin.from('profiles').update(patch).eq('id', data.user.id)
      if (profileError) throw profileError
      await audit(actor, { id: data.user.id, display_name: patch.display_name, email }, 'create', 'Usuário criado', `${role === 'admin' ? 'Administrativo' : 'Equipe de Campo'} · contato ${whatsapp}`)
      return json({ user: { id: data.user.id, email } })
    }

    const targetId = String(body.user_id || '')
    if (!targetId) throw new Error('Usuário não informado.')
    const { data: existing, error: existingError } = await admin.from('profiles').select('*').eq('id', targetId).single()
    if (existingError) throw existingError
    const { data: authTarget } = await admin.auth.admin.getUserById(targetId)
    const target = { ...existing, email: authTarget.user?.email || '' }

    if (action === 'update') {
      const nextRole = body.role === 'admin' ? 'admin' : 'field'
      const nextActive = body.active !== false
      await protectLastAdmin(targetId, nextRole, nextActive, actor.user.id)
      const whatsapp = phone(body.whatsapp_number)
      if (nextActive && !whatsapp) throw new Error('Usuários ativos precisam ter um telefone/WhatsApp de contato cadastrado.')
      const patch = {
        display_name: String(body.display_name || existing.display_name || '').trim(), role: nextRole, active: nextActive,
        whatsapp_number: whatsapp,
        push_notifications_enabled: bool(body.push_notifications_enabled, existing.push_notifications_enabled ?? true),
        notify_new_reports: bool(body.notify_new_reports, existing.notify_new_reports ?? true),
        notify_report_received: bool(body.notify_report_received, existing.notify_report_received ?? true),
        notify_report_approved: bool(body.notify_report_approved, existing.notify_report_approved ?? true),
        notify_report_rejected: bool(body.notify_report_rejected, existing.notify_report_rejected ?? true),
        notify_report_corrected: bool(body.notify_report_corrected, existing.notify_report_corrected ?? true),
      }
      const { error } = await admin.from('profiles').update(patch).eq('id', targetId)
      if (error) throw error
      await audit(actor, target, 'update', 'Usuário atualizado', `${nextRole === 'admin' ? 'Administrativo' : 'Equipe de Campo'} · ${nextActive ? 'Ativo' : 'Desativado'} · ${whatsapp || 'sem telefone'}`)
      return json({ ok: true })
    }

    if (action === 'reset_password') {
      const password = String(body.password || '')
      if (password.length < 8) throw new Error('A senha temporária deve ter pelo menos 8 caracteres.')
      const { error } = await admin.auth.admin.updateUserById(targetId, { password })
      if (error) throw error
      await admin.from('profiles').update({ must_change_password: true }).eq('id', targetId)
      await audit(actor, target, 'reset_password', 'Senha temporária gerada')
      return json({ ok: true })
    }

    if (action === 'approve') {
      const requestedRole = existing.requested_role === 'admin' ? 'admin' : 'field'
      const whatsapp = phone(body.whatsapp_number || existing.whatsapp_number)
      if (!whatsapp) throw new Error('Informe o telefone/WhatsApp de contato antes de aprovar este acesso.')
      const { error } = await admin.from('profiles').update({
        role: requestedRole, active: true, approval_status: 'approved', approved_at: new Date().toISOString(), approved_by: actor.user.id,
        whatsapp_number: whatsapp, push_notifications_enabled: true,
      }).eq('id', targetId)
      if (error) throw error
      await audit(actor, target, 'approve', 'Acesso aprovado', `${requestedRole === 'admin' ? 'Administrativo' : 'Equipe de Campo'} · contato ${whatsapp}`)
      return json({ ok: true })
    }

    if (action === 'reject') {
      await protectLastAdmin(targetId, existing.role || 'field', false, actor.user.id).catch(() => {})
      const { error } = await admin.from('profiles').update({ active: false, approval_status: 'rejected' }).eq('id', targetId)
      if (error) throw error
      await audit(actor, target, 'reject', 'Solicitação rejeitada')
      return json({ ok: true })
    }

    throw new Error('Ação não suportada.')
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : String(error) }, 400)
  }
})
