const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://tpmtmnybppunuxemarti.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_2y0Rys2ROOAPOcfN-7rb_g_tTyd4ksI'

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export interface Caller { id: string; token: string }

export async function getCaller(req: Request): Promise<Caller | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const user = await res.json()
  return user?.id ? { id: user.id, token } : null
}

export async function db(c: Caller, path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json', ...((init.headers as Record<string, string>) ?? {}) },
  })
}

const LIMITS: Record<'scan' | 'meal_plan', number> = {
  scan: Number(process.env.DAILY_SCAN_LIMIT ?? 25),
  meal_plan: Number(process.env.DAILY_PLAN_LIMIT ?? 3),
}

export async function useQuota(c: Caller, kind: 'scan' | 'meal_plan'): Promise<string | null> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const res = await db(c, `ai_usage?select=id&kind=eq.${kind}&created_at=gte.${since}`, { headers: { Prefer: 'count=exact', Range: '0-0' } })
  const count = Number((res.headers.get('content-range') ?? '*/0').split('/')[1] ?? 0)
  if (count >= LIMITS[kind]) return `Daily AI limit reached (${LIMITS[kind]}). Use Search or the free plan, or try again tomorrow.`
  await db(c, 'ai_usage', { method: 'POST', body: JSON.stringify({ kind }) })
  return null
}

export const AI_MODEL = process.env.AI_MODEL ?? 'anthropic/claude-sonnet-5'

export function aiErrorMessage(e: unknown): string {
  const msg = String((e as Error)?.message ?? e)
  if (/credit|balance|budget|quota|402|payment/i.test(msg)) return 'AI is paused: the monthly AI budget is used up. Everything else still works.'
  if (/auth|oidc|api key|401|403/i.test(msg)) return 'AI is not set up yet. Everything else works without it.'
  return 'The AI could not answer right now. Please try again or use Search.'
}
