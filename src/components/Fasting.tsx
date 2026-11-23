import { useCallback, useEffect, useState } from 'react'
import { currentFast, lastFasts, type Fast } from '../lib/data'
import { supabase } from '../lib/supabase'
import { Bar, Seg, useToast } from './ui'

const PLANS = [
  { id: 14, label: '14:10' },
  { id: 16, label: '16:8' },
  { id: 18, label: '18:6' },
  { id: 20, label: '20:4' },
]

const hm = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000))
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export const fastingVisible = () => {
  try {
    return localStorage.getItem('show-fasting') !== 'off'
  } catch {
    return true
  }
}

export default function FastingCard() {
  const toast = useToast()
  const [fast, setFast] = useState<Fast | null>(null)
  const [recent, setRecent] = useState<Fast[]>([])
  const [loaded, setLoaded] = useState(false)
  const [plan, setPlan] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('fast-plan')) || 16
    } catch {
      return 16
    }
  })
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([currentFast(), lastFasts(7)])
    setFast(c)
    setRecent(r)
    setLoaded(true)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (!fast) return
    const t = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(t)
  }, [fast])

  const pickPlan = (p: number) => {
    setPlan(p)
    try {
      localStorage.setItem('fast-plan', String(p))
    } catch {
      /* ignore */
    }
  }
  const start = async () => {
    const { error } = await supabase.from('fasts').insert({ target_hours: plan })
    if (error) return toast(error.message)
    setNow(Date.now())
    load()
  }
  const end = async () => {
    if (!fast) return
    const { error } = await supabase.from('fasts').update({ ended_at: new Date().toISOString() }).eq('id', fast.id)
    if (error) return toast(error.message)
    const h = (Date.now() - new Date(fast.started_at).getTime()) / 3600000
    toast(h >= fast.target_hours ? `Fast complete: ${hm(h * 3600000)} ✓` : `Fast ended after ${hm(h * 3600000)}`)
    load()
  }

  if (!loaded || !fastingVisible()) return null
  const reached = recent.filter((f) => f.ended_at && new Date(f.ended_at).getTime() - new Date(f.started_at).getTime() >= f.target_hours * 3600000).length

  if (!fast) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Fasting</h2>
          {recent.length > 0 && <span className="small muted">{reached} of last {recent.length} reached</span>}
        </div>
        <div className="row">
          <div className="grow"><Seg<number> options={PLANS} value={plan} onChange={pickPlan} /></div>
          <button className="btn sm" onClick={start}>Start</button>
        </div>
      </section>
    )
  }

  const startMs = new Date(fast.started_at).getTime()
  const elapsed = now - startMs
  const target = fast.target_hours * 3600000
  const done = elapsed >= target
  const endAt = new Date(startMs + target)
  return (
    <section className="card">
      <div className="card-head">
        <h2>Fasting · {fast.target_hours}h</h2>
        {done ? <span className="pill accent">Goal reached ✓</span> : <span className="small muted">eat at {endAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 700 }} className="num">{hm(elapsed)}</span>
        <span className="small muted num">{done ? `+${hm(elapsed - target)}` : `${hm(target - elapsed)} left`}</span>
      </div>
      <Bar value={elapsed} max={target} color="var(--sleep)" />
      <button className="btn ghost block sm" style={{ marginTop: 12 }} onClick={end}>{done ? 'End fast' : 'End fast early'}</button>
    </section>
  )
}
