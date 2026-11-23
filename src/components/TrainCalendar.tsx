import { useEffect, useState } from 'react'
import { workoutsBetween } from '../lib/data'
import { isSameDay, WEEKDAYS } from '../lib/dates'
import { fmtDuration } from '../lib/geo'
import type { WorkoutLog } from '../lib/types'

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

/** Month calendar of everything you trained. GPS activities are blue, workouts green. */
export default function TrainCalendar({ version, onOpen, selected, onSelect }: { version: number; onOpen?: (w: WorkoutLog) => void; selected?: Date; onSelect?: (d: Date) => void }) {
  const [month, setMonth] = useState(() => monthStart(selected ?? new Date()))
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [ownDay, setOwnDay] = useState<Date>(new Date())
  const day = selected ?? ownDay
  const setDay = (d: Date) => (onSelect ? onSelect(d) : setOwnDay(d))
  useEffect(() => {
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    workoutsBetween(month.toISOString(), next.toISOString()).then(setLogs)
  }, [month, version])

  const first = (month.getDay() + 6) % 7 // Monday = 0
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]
  while (cells.length % 7) cells.push(null)
  const on = (d: Date) => logs.filter((l) => isSameDay(new Date(l.done_at), d))
  const today = new Date()
  const activeDays = new Set(logs.map((l) => new Date(l.done_at).getDate())).size
  const minutes = logs.reduce((s, l) => s + (l.duration_s ? l.duration_s / 60 : l.duration_min ?? 0), 0)
  const km = logs.reduce((s, l) => s + (l.distance_m ?? 0), 0) / 1000
  const shown = on(day)
  const shift = (n: number) => {
    const m = new Date(month.getFullYear(), month.getMonth() + n, 1)
    setMonth(m)
    if (!onSelect) setDay(m)
  }

  return (
    <section className="card">
      <div className="card-head">
        <button className="btn ghost sm icon" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <h2 style={{ margin: 0 }}>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
        <button className="btn ghost sm icon" onClick={() => shift(1)} aria-label="Next month" disabled={monthStart(today) <= month}>›</button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w[0]}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const l = on(d)
          const gps = l.some((x) => x.distance_m != null)
          const gym = l.some((x) => x.distance_m == null)
          const cls = ['cal-day', isSameDay(d, today) ? 'today' : '', isSameDay(d, day) ? 'sel' : '', l.length ? 'has' : ''].join(' ')
          return (
            <button key={i} className={cls} onClick={() => setDay(d)} aria-label={`${d.getDate()}: ${l.length} sessions`}>
              <span>{d.getDate()}</span>
              <span className="cal-dots">
                {gym && <i className="g" />}
                {gps && <i className="r" />}
              </span>
            </button>
          )
        })}
      </div>
      <div className="row" style={{ justifyContent: 'space-around', margin: '12px 0 4px', textAlign: 'center' }}>
        <div><div className="num" style={{ fontWeight: 700, fontSize: 18 }}>{activeDays}</div><div className="small muted">active days</div></div>
        <div><div className="num" style={{ fontWeight: 700, fontSize: 18 }}>{Math.round(minutes / 6) / 10} h</div><div className="small muted">trained</div></div>
        <div><div className="num" style={{ fontWeight: 700, fontSize: 18 }}>{km.toFixed(1)}</div><div className="small muted">km tracked</div></div>
      </div>
      {onOpen && <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
        <div className="small muted" style={{ marginBottom: 4 }}>{day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        {!shown.length && <div className="small muted">Nothing logged.</div>}
        {shown.map((l) => (
          <button key={l.id} className="list-item" style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '6px 0' }} onClick={() => onOpen(l)}>
            <i className={'cal-bullet ' + (l.distance_m != null ? 'r' : 'g')} />
            <div className="grow">
              <div className="title">{l.title}</div>
              <div className="small muted">
                {l.distance_m != null ? `${(l.distance_m / 1000).toFixed(2)} km · ` : ''}
                {l.duration_s ? fmtDuration(l.duration_s) : l.duration_min ? `${l.duration_min} min` : ''}
                {Array.isArray(l.exercises) && l.exercises.length ? ` · ${(l.exercises as { done?: boolean }[]).filter((e) => e.done).length} exercises` : ''}
              </div>
            </div>
            <span className="muted">›</span>
          </button>
        ))}
      </div>}
    </section>
  )
}
