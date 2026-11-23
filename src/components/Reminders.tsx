import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Sheet, useToast } from './ui'

type Kind = 'weigh' | 'lunch' | 'water' | 'workout' | 'dinner'
type Rem = { on: boolean; time: string }
type Rems = Record<Kind, Rem>

const LIST: { id: Kind; icon: string; label: string; hint: string }[] = [
  { id: 'weigh', icon: '⚖️', label: 'Morning weigh-in', hint: 'Skipped if you already logged your weight' },
  { id: 'lunch', icon: '🌱', label: 'Feed Pip lunch', hint: 'Skipped if you logged a meal recently' },
  { id: 'water', icon: '💧', label: 'Drink water', hint: 'Skipped once you hit your water goal' },
  { id: 'workout', icon: '💪', label: 'Workout', hint: 'Skipped if you trained today' },
  { id: 'dinner', icon: '🍽️', label: 'Log dinner', hint: 'Skipped if you logged a meal recently' },
]
const DEFAULTS: Rems = {
  weigh: { on: true, time: '07:30' },
  lunch: { on: true, time: '12:30' },
  water: { on: true, time: '15:00' },
  workout: { on: false, time: '18:00' },
  dinner: { on: true, time: '19:30' },
}

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

function b64ToBytes(b64: string) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

async function currentSub() {
  if (!supported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

function subRow(sub: PushSubscription) {
  const j = sub.toJSON()
  return { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '' }
}

export function RemindersSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [on, setOn] = useState<boolean | null>(null)
  const [rems, setRems] = useState<Rems>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    fetch('/api/push').then((r) => r.json()).then((d) => setKey(d.publicKey ?? null)).catch(() => setKey(null))
    supabase.from('push_settings').select('reminders').maybeSingle().then(({ data }) => {
      if (data?.reminders && Object.keys(data.reminders).length) setRems({ ...DEFAULTS, ...(data.reminders as Partial<Rems>) })
    })
    currentSub().then((s) => setOn(!!s && Notification.permission === 'granted')).catch(() => setOn(false))
  }, [])

  async function saveRems(next: Rems) {
    setRems(next)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'
    const { error } = await supabase.from('push_settings').upsert({ reminders: next, tz, updated_at: new Date().toISOString() })
    if (error) toast('Could not save: ' + error.message)
  }

  async function turnOn() {
    if (!key) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { toast('Notifications are blocked. Allow them in your phone settings.'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }))
      const { error } = await supabase.from('push_subscriptions').upsert(subRow(sub))
      if (error) throw error
      await saveRems(rems)
      setOn(true)
      toast('Reminders on 🔔')
    } catch (e) { toast((e as Error).message || 'Could not turn on reminders') } finally { setBusy(false) }
  }

  async function turnOff() {
    setBusy(true)
    try {
      const sub = await currentSub()
      if (sub) { await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe() }
      setOn(false)
      toast('Reminders off on this device')
    } finally { setBusy(false) }
  }

  async function test() {
    const sub = await currentSub()
    if (!sub) return
    const { data } = await supabase.auth.getSession()
    const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify(subRow(sub)) })
    toast(r.ok ? 'Test sent. Check your notifications.' : 'Test failed. Try turning reminders off and on.')
  }

  let blocker: string | null = null
  if (!supported()) blocker = isIOS() && !standalone()
    ? 'On iPhone, reminders work when Lighter is on your Home Screen. Tap Share, then "Add to Home Screen", and open Lighter from there.'
    : 'This browser does not support notifications.'
  else if (key === null) blocker = 'Reminders are almost ready. They will switch on here soon.'

  return (
    <Sheet title="Reminders" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>Gentle nudges from Pip. Free, and you choose which ones. Reminders you already did are skipped automatically.</p>
      {blocker ? <div className="card" style={{ padding: 14 }}><p className="small" style={{ margin: 0 }}>{blocker}</p></div> : (
        <>
          {on === false && <button className="btn block" disabled={busy || !key} onClick={turnOn}>{busy ? 'Turning on…' : '🔔 Turn on reminders'}</button>}
          {on && (
            <div className="set-list rem-list">
              {LIST.map((r) => (
                <div key={r.id} className="rem-row">
                  <label className="rem-main">
                    <input type="checkbox" checked={rems[r.id].on} onChange={(e) => saveRems({ ...rems, [r.id]: { ...rems[r.id], on: e.target.checked } })} />
                    <span><b>{r.icon} {r.label}</b><span className="small muted">{r.hint}</span></span>
                  </label>
                  <input className="input rem-time" type="time" value={rems[r.id].time} disabled={!rems[r.id].on}
                    onChange={(e) => e.target.value && saveRems({ ...rems, [r.id]: { ...rems[r.id], time: e.target.value } })} />
                </div>
              ))}
            </div>
          )}
          {on && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={test}>Send test</button>
              <button className="btn ghost" style={{ flex: 1 }} disabled={busy} onClick={turnOff}>Turn off</button>
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}
