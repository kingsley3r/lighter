import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { addDays, fmtShort, parseDate, WEEKDAYS, WEEKDAYS_LONG } from '../lib/dates'
import { GOAL_ICON, GOAL_TEXT, goalFor, pipLine, setGoal, suggestGoals, thisWeek, weekSummary, type WeekSummary, type WeeklyGoal } from '../lib/weekly'
import { PetFigure } from './Pet'
import { readLocalOutfit } from '../lib/outfits'
import { Bar, Sheet, useToast } from './ui'

/** The week a check-in reviews: on Sunday the current week, otherwise last week. */
export function reviewWeek(now = new Date()) {
  return now.getDay() === 0 ? thisWeek() : addDays(thisWeek(), -7)
}
/** Check-in is offered Sunday from noon until Tuesday night, if no goal is set yet. */
export function checkinWindow(now = new Date()) {
  const d = now.getDay()
  return (d === 0 && now.getHours() >= 12) || d === 1 || d === 2
}

export function WeeklyCard({ onOpen }: { onOpen: () => void }) {
  const { profile, version } = useStore()
  const [state, setState] = useState<{ due: boolean; goal: WeeklyGoal | null; done: number } | null>(null)
  useEffect(() => {
    if (!profile) return
    let live = true
    ;(async () => {
      const next = addDays(reviewWeek(), 7)
      const [nextGoal, goal] = await Promise.all([goalFor(next), goalFor(thisWeek())])
      const due = checkinWindow() && !nextGoal
      const done = goal ? (await weekSummary(thisWeek(), profile)).counts[goal.kind] : 0
      if (live) setState({ due, goal, done })
    })()
    return () => { live = false }
  }, [profile, version])
  if (!state) return null
  if (state.due) return (
    <button className="card weekly-due" onClick={onOpen}>
      <div className="weekly-pip"><PetFigure mood="happy" level={4} eating={false} flex size={64} outfit={readLocalOutfit()} /></div>
      <div className="grow" style={{ textAlign: 'left' }}>
        <div style={{ fontWeight: 700 }}>Your weekly check-in is ready</div>
        <div className="small muted">Pip looked at your week and has a goal for you.</div>
      </div>
      <span className="pill accent">Open</span>
    </button>
  )
  if (!state.goal) return null
  const { kind, target } = state.goal
  const ok = state.done >= target
  return (
    <section className="card">
      <div className="card-head">
        <h2>{GOAL_ICON[kind]} This week’s goal</h2>
        {ok ? <span className="pill accent">Done ✓</span> : <button className="link" onClick={onOpen}>Last week</button>}
      </div>
      <div className="small" style={{ marginBottom: 8 }}>{GOAL_TEXT[kind](target)}</div>
      <Bar value={Math.min(state.done, target)} max={target} color="var(--accent)" />
      <div className="small muted num" style={{ marginTop: 6 }}>{state.done} / {target}{ok ? ' · Pip is proud of you 🌱' : ''}</div>
    </section>
  )
}

export function WeeklySheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { profile } = useStore()
  const toast = useToast()
  const start = reviewWeek()
  const [s, setS] = useState<WeekSummary | null>(null)
  const [prev, setPrev] = useState<{ goal: WeeklyGoal; done: number } | null>(null)
  const [pick, setPick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState<WeeklyGoal | null>(null)

  useEffect(() => {
    if (!profile) return
    Promise.all([weekSummary(start, profile), goalFor(start), goalFor(addDays(start, 7))]).then(([sum, g, next]) => {
      setS(sum)
      if (g) setPrev({ goal: g, done: sum.counts[g.kind] })
      setExisting(next)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  if (!profile) return null
  const end = addDays(start, 6)
  const title = `Week of ${fmtShort(start)} – ${fmtShort(end)}`
  if (!s) return <Sheet title="Weekly check-in" onClose={onClose}><p className="muted">Pip is looking at your week…</p></Sheet>

  const goals = suggestGoals(s, profile)
  const delta = s.weightStart != null && s.weightEnd != null ? Math.round((s.weightEnd - s.weightStart) * 10) / 10 : null
  const kT = profile.kcal_target ?? 2000
  const best = s.bestDay

  async function save() {
    setSaving(true)
    const { error } = await setGoal(addDays(start, 7), goals[pick])
    setSaving(false)
    if (error) return toast(error.message)
    toast('Goal set. Pip will cheer you on 🌱')
    onDone()
    onClose()
  }

  return (
    <Sheet title="Weekly check-in" onClose={onClose}>
      <div className="weekly-hero">
        <PetFigure mood="happy" level={5} eating={false} flex size={110} outfit={readLocalOutfit()} />
        <div className="weekly-say">{pipLine(s, prev)}</div>
      </div>
      <div className="small muted" style={{ textAlign: 'center', marginBottom: 12 }}>{title}</div>

      <div className="week-dots" aria-label="Days logged">
        {s.days.map((d, i) => {
          const on = d.meals > 0 && d.kcal >= kT * 0.8 && d.kcal <= kT * 1.05
          return <div key={d.date} className={`wd${d.meals ? ' logged' : ''}${on ? ' hit' : ''}`} title={WEEKDAYS_LONG[i]}><span>{WEEKDAYS[i][0]}</span></div>
        })}
      </div>
      <div className="small muted" style={{ textAlign: 'center', margin: '4px 0 14px' }}>Filled = logged · green = within your calories</div>

      <div className="me-tiles weekly-tiles">
        <Tile label="Weight" value={delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta} kg`} good={delta != null && delta < 0} />
        <Tile label="Avg calories" value={s.avgKcal ? `${s.avgKcal}` : '—'} sub={`goal ${kT}`} />
        <Tile label="Days logged" value={`${s.counts.log}/7`} good={s.counts.log >= 6} />
        <Tile label="Protein days" value={`${s.counts.protein}/7`} good={s.counts.protein >= 5} />
        <Tile label="Workouts" value={`${s.counts.workouts}`} good={s.counts.workouts >= (profile.training_days ?? 3)} />
        <Tile label="Water days" value={`${s.counts.water}/7`} good={s.counts.water >= 5} />
      </div>

      {best && (
        <div className="card weekly-best">
          <div className="small muted">⭐ Best day</div>
          <div style={{ fontWeight: 700 }}>{WEEKDAYS_LONG[(parseDate(best.date).getDay() + 6) % 7]}</div>
          <div className="small muted">{Math.round(best.kcal)} kcal · {Math.round(best.protein)} g protein{best.workouts ? ' · workout ✓' : ''}</div>
        </div>
      )}

      {prev && (
        <div className={`weekly-prev ${prev.done >= prev.goal.target ? 'ok' : ''}`}>
          <span>{prev.done >= prev.goal.target ? '✅' : '➖'}</span>
          <span className="grow small">Last goal: {GOAL_TEXT[prev.goal.kind](prev.goal.target)}</span>
          <b className="num small">{prev.done}/{prev.goal.target}</b>
        </div>
      )}

      {existing ? (
        <div className="weekly-prev ok" style={{ marginTop: 14 }}>
          <span>{GOAL_ICON[existing.kind]}</span><span className="grow small">Goal for this week: {GOAL_TEXT[existing.kind](existing.target)}</span>
        </div>
      ) : (
        <>
          <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>Pick one goal for next week</h3>
          <div className="goal-opts" role="radiogroup">
            {goals.map((g, i) => (
              <button key={g.kind} role="radio" aria-checked={pick === i} className={pick === i ? 'on' : ''} onClick={() => setPick(i)}>
                <span className="gi">{GOAL_ICON[g.kind]}</span>
                <span className="grow">{GOAL_TEXT[g.kind](g.target)}{i === 0 && <span className="small muted"> · Pip’s pick</span>}</span>
              </button>
            ))}
          </div>
          <button className="btn block" style={{ marginTop: 12 }} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Set this goal'}</button>
        </>
      )}
    </Sheet>
  )
}

function Tile({ label, value, sub, good }: { label: string; value: string; sub?: string; good?: boolean }) {
  return (
    <div className="me-tile static">
      <div className="small muted">{label}</div>
      <div className="num" style={{ fontWeight: 700, fontSize: 18, color: good ? 'var(--accent)' : undefined }}>{value}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  )
}
