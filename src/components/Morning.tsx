import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { setSleep } from '../lib/data'
import { isoDate } from '../lib/dates'
import { ENERGY, MOODS, sleepMoodInsights, type Insights } from '../lib/insights'
import type { SleepLog } from '../lib/types'
import { Bar, Seg, Sheet, useToast } from './ui'

/** Shown on Today until noon-ish when last night isn't logged yet. */
export function MorningCard({ logged, onOpen }: { logged: boolean; onOpen: () => void }) {
  const h = new Date().getHours()
  if (logged || h < 4 || h >= 14) return null
  return (
    <button className="card morning" onClick={onOpen}>
      <span className="morning-sun">☀️</span>
      <div className="grow">
        <b>Good morning! Quick check-in?</b>
        <div className="small muted">Sleep, mood and energy in 10 seconds.</div>
      </div>
      <span className="pill accent">Start</span>
    </button>
  )
}

export function MorningSheet({ current, onClose, onSaved }: { current: SleepLog | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [h, setH] = useState(current?.hours ?? 7.5)
  const [q, setQ] = useState<number>(current?.quality ?? 3)
  const [mood, setMood] = useState<number>(current?.mood ?? 3)
  const [energy, setEnergy] = useState<number>(current?.energy ?? 3)
  const save = async () => {
    const { error } = await setSleep(isoDate(), h, q, { mood, energy })
    if (error) return toast(error.message)
    toast(mood <= 2 ? 'Saved. Be kind to yourself today 💚' : 'Check-in saved ✓')
    onSaved()
    onClose()
  }
  const opts = (xs: string[]) => xs.map((label, i) => ({ id: i + 1, label }))
  return (
    <Sheet title="Morning check-in" onClose={onClose}>
      <div className="small muted">Hours slept</div>
      <div style={{ textAlign: 'center', fontSize: 34, fontWeight: 700 }} className="num">{h} h</div>
      <input type="range" min={3} max={12} step={0.5} value={h} onChange={(e) => setH(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--sleep)', margin: '8px 0 14px' }} aria-label="Hours slept" />
      <label className="field"><span>Sleep quality</span>
        <Seg<number> options={opts(['😫', '😕', '😐', '🙂', '😴'])} value={q} onChange={setQ} />
      </label>
      <label className="field"><span>Mood</span>
        <Seg<number> options={opts(MOODS)} value={mood} onChange={setMood} />
      </label>
      <label className="field"><span>Energy</span>
        <Seg<number> options={opts(ENERGY)} value={energy} onChange={setEnergy} />
      </label>
      <p className="small muted" style={{ marginTop: 0 }}>After 10 check-ins, Stats shows how your sleep and mood affect eating and training.</p>
      <button className="btn block" onClick={save}>Save</button>
    </Sheet>
  )
}

/** Stats card: what sleep, mood and energy do to eating and training. */
export function InsightsCard() {
  const { profile, version } = useStore()
  const [r, setR] = useState<Insights | null>(null)
  useEffect(() => { sleepMoodInsights(profile?.sleep_target_h ?? 8).then(setR) }, [profile?.sleep_target_h, version])
  if (!r) return null
  return (
    <section className="card">
      <div className="card-head"><h2>Sleep & mood insights</h2></div>
      {r.count < r.needed ? (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>Do the morning check-in on Today. After {r.needed} days with food logged, you’ll see how sleep and mood change your eating and training.</p>
          <Bar value={r.count} max={r.needed} color="var(--sleep)" />
          <div className="small muted" style={{ marginTop: 6 }}>{r.count} of {r.needed} days</div>
        </>
      ) : r.items.length === 0 ? (
        <p className="small muted" style={{ marginTop: 0 }}>No clear patterns yet across {r.count} days. Your eating looks steady no matter how you slept. Keep checking in.</p>
      ) : (
        <div className="insights">
          {r.items.map((it, i) => {
            const max = Math.max(it.a.value, it.b.value) || 1
            return (
              <div key={i} className="insight">
                <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}><span className="pf-icon">{it.icon}</span><div className="grow small">{it.text}</div></div>
                {[it.a, it.b].map((x, j) => (
                  <div key={j} className="insight-bar">
                    <span className="small muted">{x.label}</span>
                    <Bar value={x.value} max={max} color={j ? 'var(--accent)' : 'var(--warn)'} />
                    <span className="small num">{x.value}{it.unit === 'kcal' ? '' : it.unit}</span>
                  </div>
                ))}
              </div>
            )
          })}
          <p className="small muted" style={{ margin: 0 }}>Based on {r.count} days. Patterns, not proof.</p>
        </div>
      )}
    </section>
  )
}
