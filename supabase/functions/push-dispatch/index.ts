import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'npm:web-push@3.6.7'

function env(name: string, required = true) {
  const value = Deno.env.get(name)?.trim()
  if (required && !value) throw new Error(`Secret ${name} não configurado.`)
  return value || ''
}

function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (raw) {
    try { return JSON.parse(raw).default as string } catch { /* noop */ }
  }
  throw new Error('Chave de serviço do Supabase não disponível.')
}

const supabase = createClient(env('SUPABASE_URL'), serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Outbox = {
  id: string
  event_type: string
  report_id: string
  recipient_user_id: string
  status: string
  attempts: number
  payload: Record<string, unknown>
}

type Subscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

function text(v: unknown, fallback = '—') {
  const s = String(v ?? '').trim()
  return s || fallback
}

function eventMessage(eventType: string, p: Record<string, unknown>, substation: string) {
  const report = text(p.report_number, 'Relatório')
  const author = text(p.author_name, 'Equipe de Campo')
  const asset = text(p.asset_label, 'Ativo não informado')
  const reason = text(p.rejection_reason, 'Consulte o motivo na Central de Manutenção.')
  switch (eventType) {
    case 'new_report_admin':
      return { title: 'Novo relatório recebido', body: `${author} · ${substation} · ${asset}`, tag: `report-${report}` }
    case 'report_received_field':
      return { title: 'Relatório recebido', body: `${report} foi recebido pela Central de Manutenção.`, tag: `report-${report}` }
    case 'report_approved_field':
      return { title: 'Relatório aprovado', body: `${report} · ${substation} · ${asset}`, tag: `report-${report}` }
    case 'report_rejected_field':
      return { title: 'Relatório devolvido para correção', body: `${report} · ${reason}`.slice(0, 220), tag: `report-${report}` }
    case 'report_corrected_admin':
      return { title: 'Relatório corrigido', body: `${author} reenviou ${report} · ${asset}`, tag: `report-${report}` }
    default:
      return { title: 'Central de Manutenção', body: `${report} possui uma nova atualização.`, tag: `report-${report}` }
  }
}

async function dispatch(outboxId: string) {
  const { data: claimed, error: claimError } = await supabase.rpc('claim_notification_outbox', { p_id: outboxId })
  if (claimError) throw claimError
  const item = (Array.isArray(claimed) ? claimed[0] : claimed) as Outbox | undefined
  if (!item) {
    const { data: current } = await supabase.from('notification_outbox').select('status,attempts').eq('id', outboxId).maybeSingle()
    return { ignored: true, status: current?.status || 'not_found', attempts: current?.attempts || 0 }
  }

  const publicKey = env('VAPID_PUBLIC_KEY')
  const privateKey = env('VAPID_PRIVATE_KEY')
  const subject = env('VAPID_SUBJECT')
  webpush.setVapidDetails(subject, publicKey, privateKey)

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('user_id', item.recipient_user_id)
    .eq('active', true)
  if (subscriptionsError) throw subscriptionsError

  if (!subscriptions?.length) {
    await supabase.from('notification_outbox').update({
      status: 'skipped',
      provider: 'web_push',
      last_error: 'Nenhum dispositivo está inscrito para notificações push.',
    }).eq('id', item.id)
    return { skipped: true, reason: 'no_active_subscriptions' }
  }

  const { data: sub } = await supabase.from('substations').select('acronym,name').eq('id', text(item.payload?.substation_id)).maybeSingle()
  const substation = sub ? `${sub.acronym || item.payload?.substation_id} — ${sub.name || ''}`.trim() : text(item.payload?.substation_id)
  const message = eventMessage(item.event_type, item.payload || {}, substation)
  const payload = JSON.stringify({
    ...message,
    notificationId: item.id,
    reportId: item.report_id,
    eventType: item.event_type,
    url: `./?notification=${encodeURIComponent(item.id)}`,
  })

  let successes = 0
  const errors: string[] = []

  for (const subscription of subscriptions as Subscription[]) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload, { TTL: 60 * 60 * 24, urgency: 'high', topic: message.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined })
      successes += 1
      await supabase.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), last_error: null, last_seen_at: new Date().toISOString() }).eq('id', subscription.id)
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || 0)
      const errText = error instanceof Error ? error.message : String(error)
      errors.push(`${statusCode || 'erro'}: ${errText}`)
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').update({ active: false, last_error: `Assinatura expirada (${statusCode}).` }).eq('id', subscription.id)
      } else {
        await supabase.from('push_subscriptions').update({ last_error: errText.slice(0, 800) }).eq('id', subscription.id)
      }
    }
  }

  if (!successes) {
    const messageText = errors.join(' | ').slice(0, 1800) || 'Falha ao enviar a notificação push.'
    await supabase.from('notification_outbox').update({ status: 'failed', provider: 'web_push', last_error: messageText }).eq('id', item.id)
    throw new Error(messageText)
  }

  await supabase.from('notification_outbox').update({
    status: 'sent', provider: 'web_push', sent_at: new Date().toISOString(), last_error: errors.length ? `${successes} dispositivo(s) atendido(s); ${errors.length} falha(s).` : null,
  }).eq('id', item.id)

  return { sent: true, id: item.id, devices: successes, failures: errors.length }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const expected = env('CENTRAL_WEBHOOK_SECRET')
    if (req.headers.get('x-central-webhook-secret') !== expected) return new Response('Unauthorized', { status: 401 })
    const body = await req.json()
    const outboxId = body?.record?.id || body?.id || body?.outbox_id
    if (!outboxId) return Response.json({ error: 'ID da fila não informado.' }, { status: 400 })
    const result = await dispatch(String(outboxId))
    return Response.json(result)
  } catch (error) {
    console.error(error)
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
})
