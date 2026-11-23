import { json } from './_lib/auth.js'

// Free check of the AI Gateway connection: reads the credit balance, makes no model call.
export async function GET(req: Request) {
  const key = process.env.AI_GATEWAY_API_KEY || req.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN
  if (!key) return json({ ok: false, reason: 'no_credentials' })
  try {
    const r = await fetch('https://ai-gateway.vercel.sh/v1/credits', { headers: { Authorization: `Bearer ${key}` } })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) return json({ ok: false, reason: 'gateway_error', status: r.status, message: String((body as { error?: { message?: string } })?.error?.message ?? '').slice(0, 300) })
    const { balance, total_used, token_pass } = body as { balance?: string; total_used?: string; token_pass?: unknown }
    return json({ ok: Number(balance ?? 0) > 0 || !!token_pass, balance, total_used, token_pass: !!token_pass, auth: process.env.AI_GATEWAY_API_KEY ? 'api_key' : 'oidc' })
  } catch (e) {
    return json({ ok: false, reason: 'network', message: String(e).slice(0, 200) })
  }
}
