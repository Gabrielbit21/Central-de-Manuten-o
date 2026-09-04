import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function sha1Hex(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(value),
  )

  return Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase()
}

async function leakedPasswordCount(password: string) {
  const hash = await sha1Hex(password)

  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          'Add-Padding': 'true',
          'User-Agent': 'Central-Manutencao-SE-Password-Security/1.0',
        },
        signal: controller.signal,
      },
    )

    if (!response.ok) {
      throw new Error(`HIBP respondeu HTTP ${response.status}.`)
    }

    const body = await response.text()

    for (const line of body.split(/\r?\n/)) {
      const [candidate, rawCount] = line.trim().split(':')

      if (candidate?.toUpperCase() === suffix) {
        return Number(rawCount || 0)
      }
    }

    return 0
  } finally {
    clearTimeout(timeout)
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
    const body = await req.json().catch(() => ({}))
    const password =
      typeof body.password === 'string'
        ? body.password
        : ''

    if (password.length < 8) {
      return json(
        {
          ok: false,
          compromised: false,
          error: 'Use uma senha com pelo menos 8 caracteres.',
        },
        400,
      )
    }

    if (password.length > 256) {
      return json(
        {
          ok: false,
          compromised: false,
          error: 'A senha excede o tamanho permitido.',
        },
        400,
      )
    }

    const count = await leakedPasswordCount(password)

    if (count > 0) {
      return json(
        {
          ok: false,
          compromised: true,
          count,
          error:
            'Esta senha já apareceu em vazamentos conhecidos. Escolha uma senha diferente.',
        },
        400,
      )
    }

    return json({
      ok: true,
      compromised: false,
    })
  } catch (error) {
    console.error(
      'password-security:',
      error instanceof Error
        ? error.message
        : String(error),
    )

    return json(
      {
        ok: false,
        compromised: false,
        error:
          'Não foi possível validar a segurança da senha agora. Tente novamente em instantes.',
      },
      503,
    )
  }
})
