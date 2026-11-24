import { useCallback, useEffect, useState } from 'react'
import { currentFast, lastFasts, type Fast } from '../lib/data'
import { supabase } from '../lib/supabase'
import { PetFigure } from './Pet'
import { readLocalOutfit } from '../lib/outfits'
import { Seg, useToast } from './ui'

const PLANS = [
  { id: 12, label: '12:12' },
  { id: 14, label: '14:10' },
  { id: 16, label: '16:8' },
  { id: 18, label: '18:6' },
  { id: 20, label: '20:4' },
  { id: 23, label: 'OMAD' },
]

/** What's roughly going on, by hours fasted. Kept simple and not medical advice. */
const STAGES: { h: number; icon: string; name: string; text: string }[] = [
  { h: 0, icon: '🍽️', name: 'Digesting', text: 'Your body is using the energy from your last meal.' },
  { h: 4, icon: '📉', name: 'Settling', text: 'Blood sugar levels off and insulin drops.' },
  { h: 12, icon: '🔥', name: 'Fat burning', text: 'Your body starts using more stored fat for energy.' },
  { h: 16, icon: '⚡', name: 'Deep fast', text: 'Fat is now a main fuel. Drink water, tea or black coffee.' },
  { h: 20, icon: '🌙', name: 'Extended', text: 'Long fast. Break it gently with protein and veggies.' },
]
const stageAt = (h: number) => [...STAGES].reverse().find((s) => h >= s.h) ?? STAGES[0]

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
    const t = window.setInterval(() => setNow(Date.now()), 10000)
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
        <div className="fast-plans"><Seg<number> options={PLANS} value={plan} onChange={pickPlan} /></div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <span className="small muted grow">{plan === 23 ? 'One meal a day: 23 h fast, 1 h to eat.' : `Fast ${plan} h, eat within ${24 - plan} h.`}</span>
          <button className="btn sm" onClick={start}>▶ Start fast</button>
        </div>
        {recent.length > 1 && <History fasts={recent} />}
      </section>
    )
  }

  const startMs = new Date(fast.started_at).getTime()
  const elapsed = now - startMs
  const target = fast.target_hours * 3600000
  const done = elapsed >= target
  const endAt = new Date(startMs + target)
  const hours = elapsed / 3600000
  const stage = stageAt(hours)
  const lastHour = !done && target - elapsed <= 3600000
  const pct = Math.min(1, elapsed / target)
  const R = 54, C = 2 * Math.PI * R
  const cheer = done ? 'You did it! Break your fast with protein 🥚' : lastHour ? 'Last hour! You’ve got this 💪' : hours >= fast.target_hours / 2 ? 'Halfway there, keep sipping water 💧' : null

  async function editStart() {
    const v = prompt('When did you start? (HH:MM)', new Date(startMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    if (!v || !/^\d{1,2}:\d{2}$/.test(v)) return
    const [hh, mm] = v.split(':').map(Number)
    const d = new Date(); d.setHours(hh, mm, 0, 0)
    if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1)
    const { error } = await supabase.from('fasts').update({ started_at: d.toISOString() }).eq('id', fast!.id)
    if (error) return toast(error.message)
    load()
  }

  return (
    <section className={`card fast-on${done ? ' done' : ''}`}>
      <div className="card-head">
        <h2>Fasting · {fast.target_hours === 23 ? 'OMAD' : `${fast.target_hours}h`}</h2>
        {done ? <span className="pill accent">Goal reached ✓</span> : <span className="small muted">eat at {endAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div className="fast-main">
        <svg className="fast-ring" viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r={R} className="fr-track" />
          <circle cx="64" cy="64" r={R} className="fr-fill" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 64 64)" />
          {STAGES.filter((st) => st.h > 0 && st.h < fast.target_hours).map((st) => { const a = (st.h / fast.target_hours) * 2 * Math.PI - Math.PI / 2; return <circle key={st.h} cx={64 + Math.cos(a) * R} cy={64 + Math.sin(a) * R} r="3.5" className={hours >= st.h ? 'fr-dot on' : 'fr-dot'} /> })}
        </svg>
        <div className="fast-center">
          <div className="num" style={{ fontSize: 24, fontWeight: 800 }}>{hm(elapsed)}</div>
          <div className="small muted num">{done ? `+${hm(elapsed - target)} extra` : `${hm(target - elapsed)} left`}</div>
        </div>
      </div>
      <div className="fast-stage"><span style={{ fontSize: 22 }}>{stage.icon}</span><div><b>{stage.name}</b><div className="small muted">{stage.text}</div></div></div>
      {cheer && (
        <div className="fast-cheer">
          <PetFigure mood="happy" level={4} eating={false} flex={done || lastHour} size={52} outfit={readLocalOutfit()} />
          <div className="fast-bubble">{cheer}</div>
        </div>
      )}
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn ghost sm grow" onClick={editStart}>Edit start</button>
        <button className={`btn sm grow${done ? '' : ' ghost'}`} onClick={end}>{done ? 'End fast 🎉' : 'End early'}</button>
      </div>
    </section>
  )
}

/** Last fasts as bars against their target. */
function History({ fasts }: { fasts: Fast[] }) {
  const rows = fasts.filter((f) => f.ended_at).slice(0, 7).reverse()
  if (rows.length < 2) return null
  const max = Math.max(...rows.map((f) => Math.max(f.target_hours, (new Date(f.ended_at!).getTime() - new Date(f.started_at).getTime()) / 3600000)))
  return (
    <div className="fast-hist">
      {rows.map((f) => {
        const h = (new Date(f.ended_at!).getTime() - new Date(f.started_at).getTime()) / 3600000
        return (
          <div key={f.id} className="fh-col" title={`${h.toFixed(1)} h of ${f.target_hours} h`}>
            <div className="fh-bar"><span className={h >= f.target_hours ? 'ok' : ''} style={{ height: `${(h / max) * 100}%` }} /><i style={{ bottom: `${(f.target_hours / max) * 100}%` }} /></div>
            <span className="fh-lbl">{new Date(f.started_at).toLocaleDateString('en-GB', { weekday: 'narrow' })}</span>
          </div>
        )
      })}
    </div>
  )
}
