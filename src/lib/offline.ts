/**
 * Offline logging: writes to the everyday log tables are queued in localStorage when
 * there is no connection and replayed (with a fresh login token) once it is back.
 * Reads fall back to the service worker cache; queued rows are merged into list reads
 * so what you logged offline shows up right away.
 */
const KEY = 'offline-queue'
const TABLES = new Set(['meal_logs', 'water_logs', 'weight_logs', 'workout_logs', 'sleep_logs', 'step_logs', 'habit_checks', 'fasts', 'shopping_items', 'body_measurements'])

interface Queued { id: number; url: string; method: string; headers: Record<string, string>; body: string | null; row?: Record<string, unknown> }

const listeners = new Set<() => void>()
export function onQueueChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
const emit = () => listeners.forEach((f) => f())

export function clearQueue() { writeQueue([]) }

export function readQueue(): Queued[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function writeQueue(q: Queued[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)) } catch { /* storage full */ }
  emit()
}

const tableOf = (url: string) => /\/rest\/v1\/([a-z_]+)/.exec(url)?.[1] ?? ''
const isRest = (url: string) => url.includes('/rest/v1/') && !url.includes('/rest/v1/rpc/')

function headersObj(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  new Headers(h).forEach((v, k) => { if (k !== 'authorization') out[k] = v })
  return out
}

let seq = 0
function fakeRow(table: string, body: Record<string, unknown>): Record<string, unknown> {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const defaults: Record<string, Record<string, unknown>> = {
    meal_logs: { eaten_at: now.toISOString() }, water_logs: { logged_at: now.toISOString() }, workout_logs: { done_at: now.toISOString() },
    weight_logs: { logged_on: today }, habit_checks: { day: today }, fasts: { started_at: now.toISOString(), ended_at: null },
  }
  return { id: -(Date.now() * 10 + (seq++ % 10)), created_at: now.toISOString(), ...defaults[table], ...body, _offline: true }
}

function reply(status: number, data?: unknown, single = false): Response {
  if (data === undefined || status === 204) return new Response(null, { status: 204 })
  return new Response(JSON.stringify(single && Array.isArray(data) ? data[0] ?? null : data), { status, headers: { 'content-type': 'application/json' } })
}

/** Change a still-queued offline row instead of sending a PATCH/DELETE for an id the server never saw. */
function editQueued(url: string, method: string, body: string | null): boolean {
  const m = /[?&]id=eq\.(-\d+)/.exec(url)
  if (!m) return false
  const id = Number(m[1])
  const q = readQueue()
  const i = q.findIndex((e) => e.row?.id === id)
  if (i < 0) return true // already gone
  if (method === 'DELETE') q.splice(i, 1)
  else {
    const patch = body ? JSON.parse(body) : {}
    const send = { ...JSON.parse(q[i].body || '{}'), ...patch }
    q[i] = { ...q[i], body: JSON.stringify(send), row: { ...q[i].row, ...patch } }
  }
  writeQueue(q)
  return true
}

function queue(url: string, init: RequestInit): Response {
  const method = (init.method || 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  const wantsRows = (headers.get('prefer') || '').includes('return=representation')
  const single = (headers.get('accept') || '').includes('vnd.pgrst.object')
  const body = typeof init.body === 'string' ? init.body : null
  if ((method === 'PATCH' || method === 'DELETE') && editQueued(url, method, body)) return reply(wantsRows ? 200 : 204, wantsRows ? [] : undefined, single)
  let row: Record<string, unknown> | undefined
  if (method === 'POST' && body) {
    const parsed = JSON.parse(body)
    const one = Array.isArray(parsed) ? parsed[0] : parsed
    row = fakeRow(tableOf(url), one)
  }
  const q = readQueue()
  q.push({ id: Date.now() + Math.random(), url, method, headers: headersObj(init.headers), body, row })
  writeQueue(q)
  return reply(method === 'POST' ? 201 : 200, wantsRows ? (row ? [row] : []) : undefined, single)
}

/** Adds queued rows to list reads of the same table (not to "latest one" lookups). */
async function mergeQueued(url: string, res: Response): Promise<Response> {
  const table = tableOf(url)
  const pending = readQueue().filter((e) => e.row && tableOf(e.url) === table).map((e) => e.row!)
  if (!pending.length || /[?&]limit=1(&|$)/.test(url)) return res
  try {
    const data = await res.clone().json()
    if (!Array.isArray(data)) return res
    // an offline upsert replaces the server row with the same key (e.g. one weight per day)
    const keys = readQueue().filter((e) => e.row && tableOf(e.url) === table).map((e) => {
      const cols = /on_conflict=([^&]+)/.exec(e.url)?.[1]
      return cols ? decodeURIComponent(cols).split(',').filter((c) => c !== 'user_id').map((c) => [c, e.row![c]] as const) : null
    }).filter((k): k is (readonly [string, unknown])[] => !!k && k.length > 0)
    const kept = data.filter((r: Record<string, unknown>) => !keys.some((k) => k.every(([c, v]) => r[c] === v)))
    const ids = new Set(kept.map((r: { id?: unknown }) => r.id))
    const out = [...kept, ...pending.filter((p) => !ids.has(p.id))]
    return new Response(JSON.stringify(out), { status: res.status, headers: res.headers })
  } catch { return res }
}

export const offlineFetch: typeof fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init.method || 'GET').toUpperCase()
  const queueable = isRest(url) && method !== 'GET' && method !== 'HEAD' && TABLES.has(tableOf(url))
  if (queueable && !navigator.onLine) return queue(url, init)
  try {
    const res = await fetch(input, init)
    return method === 'GET' && isRest(url) ? mergeQueued(url, res) : res
  } catch (err) {
    if (queueable) return queue(url, init)
    if (method === 'GET' && isRest(url) && !(new Headers(init.headers).get('accept') || '').includes('vnd.pgrst.object')) return mergeQueued(url, reply(200, []))
    throw err
  }
}

let syncing = false
/** Sends queued writes in order. Rows the server rejects (e.g. a duplicate) are dropped so the queue never jams. */
export async function flushQueue(getToken: () => Promise<string | null>): Promise<number> {
  if (syncing || !navigator.onLine) return 0
  const start = readQueue()
  if (!start.length) return 0
  syncing = true
  let sent = 0
  try {
    const token = await getToken()
    if (!token) return 0
    for (const e of start) {
      const headers = { ...e.headers, authorization: `Bearer ${token}`, prefer: (e.headers.prefer || '').replace('return=representation', 'return=minimal') }
      let ok = true
      try {
        const res = await fetch(e.url, { method: e.method, headers, body: e.body })
        ok = res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408 && res.status !== 429)
      } catch { ok = false }
      if (!ok) break // still offline or server trouble: keep the rest for later
      writeQueue(readQueue().filter((x) => x.id !== e.id))
      sent++
    }
  } finally { syncing = false }
  return sent
}
