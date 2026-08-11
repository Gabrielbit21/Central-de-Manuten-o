import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')?.trim()
  if (!publicKey) return Response.json({ error: 'VAPID_PUBLIC_KEY não configurada.' }, { status: 503, headers: cors })
  return Response.json({ publicKey }, { headers: { ...cors, 'Cache-Control': 'no-store' } })
})
