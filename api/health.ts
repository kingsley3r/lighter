import { json } from './_lib/auth.js'

// Receives steps (and optionally weight) from the iOS Shortcuts automation.
// Auth: the personal token from Lighter → Settings → Apple Health, sent as "Authorization: Bearer lt_…".
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://tpmtmnybppunuxemarti.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_2y0Rys2ROOAPOcfN-7rb_g_tTyd4ksI'

/** Shortcuts may send numbers as localized text ("8.532", "8,532", "82,4 kg"). */
function num(v: unknown, decimals: boolean): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim().replace(/[^\d.,-]/g, '')
  if (!s) return null
  if (!decimals) return Number(s.replace(/[.,]/g, '')) || 0
  // the last separator is the decimal one when it has 1–2 digits after it
  const m = s.match(/^(.*?)[.,](\d{1,2})$/)
  s = m ? m[1].replace(/[.,]/g, '') + '.' + m[2] : s.replace(/[.,]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim() || new URL(req.url).searchParams.get('token') || ''
  if (!token.startsWith('lt_')) return json({ ok: false, error: 'Missing token. Copy it from Lighter: Settings → Apple Health.' }, 401)
  let body: Record<string, unknown> = {}
  try { body = (await req.json()) as Record<string, unknown> } catch { /* empty body */ }
  const steps = num(body.steps, false)
  const weight = num(body.weight ?? body.weight_kg, true)
  const day = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null
  if (steps == null && weight == null) return json({ ok: false, error: 'Send "steps" and/or "weight".' }, 400)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/health_ingest`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, steps: steps == null ? null : Math.round(steps), day, weight_kg: weight }),
  })
  if (!res.ok) return json({ ok: false, error: 'Could not save. Please try again.' }, 502)
  const out = (await res.json()) as { ok: boolean; error?: string }
  return json(out, out.ok ? 200 : 401)
}

export async function GET() {
  return json({ ok: true, hint: 'POST {"steps": 8532, "weight": 82.4} with "Authorization: Bearer <your Lighter token>"' })
}
