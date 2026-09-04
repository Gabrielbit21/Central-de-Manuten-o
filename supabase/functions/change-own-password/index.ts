import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (raw) return JSON.parse(raw).default as string

  throw new Error('Chave de serviço do Supabase não disponível.')
}

const url = Deno.env.get('SUPABASE_URL')!

const admin = createClient(url, serviceKey(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

async function assertSafePassword(password: string) {
  const response = await fetch(
    `${url}/functions/v1/password-security`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey(),
      },
      body: JSON.stringify({ password }),
    },
  )

  const result = await response.json().catch(() => ({}))

  if (!response.ok || result?.ok !== true) {
    throw new Error(
      result?.error ||
      'Não foi possível validar a segurança da senha agora.',
    )
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : ''

    if (!token) {
      return json({ error: 'Sessão inválida.' }, 401)
    }

    const { data: userData, error: userError } =
      await admin.auth.getUser(token)

    if (userError || !userData.user) {
      return json(
        { error: 'Sessão inválida ou expirada.' },
        401,
      )
    }

    const body = await req.json().catch(() => ({}))
    const password =
      typeof body.password === 'string'
        ? body.password
        : ''

    if (password.length < 8) {
      return json(
        { error: 'Use uma senha com pelo menos 8 caracteres.' },
        400,
      )
    }

    if (password.length > 256) {
      return json(
        { error: 'A senha excede o tamanho permitido.' },
        400,
      )
    }

    const { data: profile, error: profileError } =
      await admin
        .from('profiles')
        .select(
          'id,active,approval_status,must_change_password',
        )
        .eq('id', userData.user.id)
        .maybeSingle()

    if (profileError) throw profileError

    if (
      !profile ||
      !profile.active ||
      profile.approval_status !== 'approved'
    ) {
      return json({ error: 'Acesso não liberado.' }, 403)
    }

    if (!profile.must_change_password) {
      return json(
        {
          error:
            'A troca obrigatória de senha já foi concluída.',
        },
        409,
      )
    }

    await assertSafePassword(password)

    const { error: passwordError } =
      await admin.auth.admin.updateUserById(
        userData.user.id,
        { password },
      )

    if (passwordError) throw passwordError

    const { data: updated, error: updateError } =
      await admin
        .from('profiles')
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userData.user.id)
        .eq('must_change_password', true)
        .select('id,must_change_password')
        .maybeSingle()

    if (updateError) throw updateError

    if (!updated) {
      return json(
        {
          error:
            'A senha foi alterada, mas não foi possível concluir a liberação. Entre novamente e tente outra vez.',
        },
        409,
      )
    }

    return json({
      ok: true,
      must_change_password: false,
    })

  } catch (error) {
    console.error(
      'change-own-password:',
      error instanceof Error
        ? error.message
        : String(error),
    )

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      400,
    )
  }
})
