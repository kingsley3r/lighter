import webpush from 'web-push'
import { getCaller, json } from './_lib/auth.js'

// Keys live only in Vercel environment variables (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).
const PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://tpmtmnybppunuxemarti.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_2y0Rys2ROOAPOcfN-7rb_g_tTyd4ksI'

interface Msg { endpoint: string; p256dh: string; auth: string; title: string; body: string; tag?: string; url?: string }

const ready = () => {
  if (!PUBLIC || !PRIVATE) return false
  webpush.setVapidDetails('https://lighter-sigma.vercel.app', PUBLIC, PRIVATE)
  return true
}

async function send(m: Msg): Promise<'ok' | 'gone' | 'error'> {
  try {
    await webpush.sendNotification(
      { endpoint: m.endpoint, keys: { p256dh: m.p256dh, auth: m.auth } },
      JSON.stringify({ title: m.title, body: m.body, tag: m.tag, url: m.url ?? '/' }),
      { TTL: 3600, urgency: 'normal' },
    )
    return 'ok'
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    return code === 404 || code === 410 ? 'gone' : 'error'
  }
}

/** True when the request comes from our own Supabase cron job (secret checked inside the database). */
async function fromCron(req: Request) {
  const s = req.headers.get('x-cron-secret')
  if (!s) return false
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_check_secret`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ s }),
  })
  return res.ok && (await res.json()) === true
}

export async function GET() {
  return json({ publicKey: PUBLIC || null })
}

export async function POST(req: Request) {
  if (!ready()) return json({ gone: [], error: 'Push is not set up yet.' }, 503)

  if (await fromCron(req)) {
    const { messages = [] } = (await req.json()) as { messages?: Msg[] }
    const results = await Promise.all(messages.slice(0, 500).map(send))
    const gone = messages.filter((_, i) => results[i] === 'gone').map((m) => m.endpoint)
    return json({ gone, sent: results.filter((r) => r === 'ok').length })
  }

  // Signed-in user asks for a test notification to their own device.
  const caller = await getCaller(req)
  if (!caller) return json({ error: 'Not signed in' }, 401)
  const { endpoint, p256dh, auth } = (await req.json()) as Partial<Msg>
  if (!endpoint || !p256dh || !auth) return json({ error: 'Missing subscription' }, 400)
  const r = await send({ endpoint, p256dh, auth, title: 'Pip says hi 🌱', body: 'Reminders are on. See you later!', tag: 'test' })
  return r === 'ok' ? json({ ok: true }) : json({ error: 'Could not deliver the test notification.' }, 502)
}
