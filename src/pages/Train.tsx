import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import { CheckBox, Sheet, useToast } from '../components/ui'
import { addDays, fmtShort, isoDate, isSameDay, WEEKDAYS_LONG, parseDate, startOfDay, startOfWeek, weekdayIdx } from '../lib/dates'
import DayStrip from '../components/DayStrip'
import { activeWorkoutPlan, lastExerciseSets, workoutsBetween, type SetLog } from '../lib/data'
import { generateWorkoutPlan, EQUIPMENT } from '../data/exercises'
import { supabase } from '../lib/supabase'
import Tracker, { hasActiveActivity } from '../components/Tracker'
import ActivityDetail from '../components/ActivityDetail'
import Autocomplete from '../components/Autocomplete'
import ExerciseFigure from '../components/ExerciseFigure'
import { ExerciseGuide, ExerciseLibrary } from '../components/ExerciseGuide'
import { guideFor } from '../data/guide'
import TrainCalendar from '../components/TrainCalendar'
import { ProgramCard } from '../components/Programs'
import { matchScore } from '../data/common-foods'
import { EXERCISES } from '../data/exercises'
import { fmtDuration, fmtKm, fmtPace, SPORTS } from '../lib/geo'
import type { PlannedExercise, PlannedWorkout, WorkoutLog, WorkoutPlan } from '../lib/types'

export default function Train() {
  const { profile, version, bump } = useStore()
  const toast = useToast()
  const [plan, setPlan] = useState<(WorkoutPlan & { id: number }) | null>(null)
  const [date, setDate] = useState(() => new Date())
  const [view, setView] = useState<'week' | 'month'>('week')
  const [weekLogs, setWeekLogs] = useState<WorkoutLog[]>([])
  const [open, setOpen] = useState<PlannedWorkout | null>(null)
  const [other, setOther] = useState(false)
  const [tracking, setTracking] = useState(hasActiveActivity)
  const [detail, setDetail] = useState<WorkoutLog | null>(null)
  const [logView, setLogView] = useState<WorkoutLog | null>(null)
  const [library, setLibrary] = useState(false)
  const [guide, setGuide] = useState<string | null>(null)
  const [progOpen, setProgOpen] = useState(false)
  const [strengthDone, setStrengthDone] = useState(0)
  const ws = startOfWeek(date)
  const wsKey = isoDate(ws)

  const load = useCallback(async () => {
    const start = parseDate(wsKey)
    const [p, l] = await Promise.all([activeWorkoutPlan(), workoutsBetween(start.toISOString(), addDays(start, 7).toISOString())])
    setPlan(p)
    setWeekLogs(l)
  }, [wsKey])
  useEffect(() => {
    load()
  }, [load, version])

  async function regenerate(days?: number) {
    if (!profile) return false
    const p = generateWorkoutPlan(profile.equipment ?? [], days ?? profile.training_days ?? 3, profile.session_minutes ?? 45)
    await supabase.from('workout_plans').update({ is_active: false }).eq('is_active', true)
    const { error } = await supabase.from('workout_plans').insert({ plan: p, is_active: true })
    if (error) { toast(error.message); return false }
    if (!days) toast('Plan updated ✓')
    await load()
    return true
  }

  const wd = weekdayIdx(date)
  const isToday = isSameDay(date, new Date())
  const isFuture = startOfDay(date) > startOfDay(new Date())
  const beforePlan = !!plan && startOfDay(date) < startOfWeek(new Date(plan.generated_at))
  const planned = beforePlan ? null : plan?.workouts.find((x) => x.weekday === wd) ?? null
  const dayLogs = weekLogs.filter((l) => isSameDay(new Date(l.done_at), date))
  const plannedDone = planned && dayLogs.some((l) => l.distance_m == null && l.title === planned.title)
  const marks = new Set(weekLogs.map((l) => isoDate(new Date(l.done_at))))
  const plannedDays = new Set((plan?.workouts ?? []).map((w) => addDays(ws, w.weekday)).filter((d) => !plan || startOfDay(d) >= startOfWeek(new Date(plan.generated_at))).map((d) => isoDate(d)))
  const weekDone = plan ? plan.workouts.filter((w) => weekLogs.some((l) => l.title === w.title && weekdayIdx(new Date(l.done_at)) === w.weekday)).length : 0
  const equipLabels = (profile?.equipment ?? []).map((id) => EQUIPMENT.find((e) => e.id === id)?.label).filter(Boolean)
  const dayLabel = isToday ? 'Today' : date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <header className="page-head">
        <div>
          <div className="sub">{dayLabel}</div>
          <h1>Training</h1>
        </div>
        {plan && <span className="pill accent">{weekDone} / {plan.workouts.length} this week</span>}
      </header>

      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="seg sm" role="tablist">
          <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Week</button>
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
        </div>
        {!isToday && <button className="link" onClick={() => setDate(new Date())}>Back to today</button>}
      </div>
      {view === 'week' ? (
        <DayStrip date={date} onChange={setDate} marks={marks} planned={plannedDays} />
      ) : (
        <TrainCalendar version={version} selected={date} onSelect={(d) => { setDate(d); setView('week') }} />
      )}

      <ProgramCard plan={plan} strengthDone={strengthDone} onStrength={(w) => { setProgOpen(true); setOpen(w) }} onBuildPlan={() => regenerate(3)} onLogged={() => { load(); bump() }} />

      {!plan ? (
        <section className="card" style={{ textAlign: 'center' }}>
          <h2>No workout plan yet</h2>
          <p className="small muted">Built from your equipment and the days you want to train.</p>
          <button className="btn block" onClick={() => regenerate()}>Build my plan</button>
        </section>
      ) : beforePlan ? null : planned ? (
        <section className={`card wo-hero${plannedDone ? ' done' : ''}`}>
          <div className="row between">
            <span className="pill accent">{plannedDone ? '✓ Completed' : isToday ? 'Today’s workout' : isFuture ? 'Planned' : 'Planned workout'}</span>
            <span className="small muted">~{planned.minutes} min · {planned.exercises.length} exercises</span>
          </div>
          <h2 style={{ margin: '10px 0 2px', fontSize: 22 }}>{planned.title}</h2>
          <div className="small muted">{planned.focus}</div>
          <div className="wo-figs">
            {planned.exercises.map((e) => {
              const g = guideFor(e.id)
              return g ? (
                <button key={e.id} className="wo-fig" onClick={() => setGuide(e.id)} aria-label={`How to do ${e.name}`}>
                  <ExerciseFigure anim={g.anim} gear={EXERCISES.find((x) => x.id === e.id)?.needs} size={64} />
                  <span>{e.name}</span>
                </button>
              ) : null
            })}
          </div>
          <button className="btn block" onClick={() => setOpen(planned)}>{plannedDone ? 'View workout' : isToday ? '▶ Start workout' : isFuture ? 'Preview workout' : 'Open workout'}</button>
        </section>
      ) : (
        <section className="card wo-rest">
          <div style={{ fontSize: 34 }}>🌿</div>
          <h2 style={{ margin: '4px 0' }}>Rest day</h2>
          <p className="small muted" style={{ margin: '0 0 10px' }}>Recovery is part of the plan. A relaxed walk keeps you moving and burns a little extra.</p>
          {isToday && <button className="btn outline" onClick={() => setTracking(true)}>🚶 Track a walk</button>}
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>{isToday ? 'Done today' : 'Done this day'}</h2></div>
        {dayLogs.length === 0 && <div className="small muted">{isFuture ? 'Nothing yet, this day is still ahead.' : 'Nothing logged.'}</div>}
        {dayLogs.map((l) => {
          const gps = l.distance_m != null
          const sp = SPORTS.find((s) => s.id === l.kind)
          const km = (l.distance_m ?? 0) / 1000
          const secs = l.duration_s ?? (l.duration_min ?? 0) * 60
          return (
            <button key={l.id} className="list-item day-log" onClick={() => (gps ? setDetail(l) : setLogView(l))}>
              <i className={'cal-bullet ' + (gps ? 'r' : 'g')} />
              <div className="grow">
                <div className="title">{l.title}{gps ? ` · ${fmtKm(l.distance_m ?? 0)} km` : ''}</div>
                <div className="small muted">
                  {new Date(l.done_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {secs ? ` · ${fmtDuration(secs)}` : ''}
                  {gps ? ` · ${sp && !sp.pace ? `${(km / (secs / 3600 || 1)).toFixed(1)} km/h` : `${fmtPace(km ? secs / km : NaN)} /km`}` : ''}
                  {!gps && Array.isArray(l.exercises) && l.exercises.length ? ` · ${(l.exercises as { done?: boolean }[]).filter((e) => e.done).length} exercises` : ''}
                </div>
              </div>
              <span className="muted">›</span>
            </button>
          )
        })}
      </section>

      <div className="quick3">
        <button className="card" onClick={() => setTracking(true)}><span>📍</span>Run, walk<br />or ride</button>
        <button className="card" onClick={() => setOther(true)}><span>➕</span>Log other<br />activity</button>
        <button className="card" onClick={() => setLibrary(true)}><span>📖</span>Exercise<br />library</button>
      </div>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Your setup</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          {profile?.training_days ?? 3}× per week · {profile?.session_minutes ?? 45} min · {equipLabels.length ? equipLabels.join(', ') : 'bodyweight only'}
        </p>
        <p className="small muted">Change equipment or days under Me, then rebuild the plan.</p>
        <button className="btn outline block" onClick={() => regenerate()}>↻ Rebuild plan</button>
      </section>

      {open && <WorkoutSheet w={open} isToday={isToday} past={!isToday && !isFuture ? date : undefined} onClose={() => { setOpen(null); setProgOpen(false) }} onDone={() => { setOpen(null); load(); bump(); if (progOpen) { setProgOpen(false); setStrengthDone((n) => n + 1) } }} />}
      {tracking && <Tracker onClose={() => setTracking(false)} onSaved={async (id) => { setTracking(false); setDate(new Date()); await load(); bump(); const { data } = await supabase.from('workout_logs').select('*').eq('id', id).single(); if (data) setDetail(data as WorkoutLog) }} />}
      {detail && <ActivityDetail a={detail} onClose={() => setDetail(null)} onDeleted={() => { setDetail(null); load(); bump() }} />}
      {library && <ExerciseLibrary equipment={profile?.equipment ?? []} onClose={() => setLibrary(false)} />}
      {guide && <ExerciseGuide id={guide} onClose={() => setGuide(null)} />}
      {logView && <LogSheet log={logView} onClose={() => setLogView(null)} onDeleted={() => { setLogView(null); load(); bump() }} />}
      {other && <OtherSheet onClose={() => setOther(false)} onDone={() => { setOther(false); load(); bump() }} />}
    </>
  )
}

const BODYWEIGHT = new Set(['bw_squat', 'glute_bridge', 'reverse_lunge', 'step_up', 'pushup', 'pike_pushup', 'towel_row', 'superman', 'plank', 'dead_bug', 'side_plank', 'mountain_climber', 'hanging_knee', 'pullup'])

function topReps(reps: string): number | null {
  const m = reps.match(/(\d+)\s*[–-]\s*(\d+)/) ?? reps.match(/^(\d+)/)
  if (!m) return null
  return Number(m[2] ?? m[1])
}

/** Simple double progression: hit the top of the rep range in every set → add load (or reps for bodyweight). */
function suggestion(e: PlannedExercise, last: SetLog[] | undefined): string | null {
  if (!last?.length) return null
  const top = topReps(e.reps)
  const worked = last.filter((s) => s.reps)
  if (!top || !worked.length) return null
  const allHit = worked.every((s) => (s.reps ?? 0) >= top)
  const kg = Math.max(...worked.map((s) => s.kg ?? 0))
  if (allHit) {
    if (kg > 0) return `You hit ${top} reps every set last time. Try ${Math.round((kg + (kg < 20 ? 1 : 2.5)) * 2) / 2} kg today.`
    return `You hit ${top} reps every set last time. Add 1–2 reps or slow the lowering to 3 s.`
  }
  return kg > 0 ? `Stay at ${kg} kg and aim for more reps than last time.` : null
}

const timed = (e: PlannedExercise) => e.rest_s === 0 || /\bs\b|min|sec/.test(e.reps)

function WorkoutSheet({ w, isToday, past, onClose, onDone }: { w: PlannedWorkout; isToday: boolean; past?: Date; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const key = `wo-${isoDate()}-${w.weekday}`
  const saved = (() => {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
  })() as { checked: string[]; sets: Record<string, SetLog[]> } | null
  const [checked, setChecked] = useState<string[]>(saved?.checked ?? [])
  const [sets, setSets] = useState<Record<string, SetLog[]>>(saved?.sets ?? {})
  const [last, setLast] = useState<Record<string, SetLog[]>>({})
  const [start] = useState(() => Date.now())
  const [mins, setMins] = useState(String(w.minutes))
  const [guide, setGuide] = useState<string | null>(null)

  useEffect(() => {
    lastExerciseSets().then((l) => {
      setLast(l)
      setSets((cur) => {
        const next = { ...cur }
        for (const e of w.exercises) {
          if (next[e.id] || timed(e)) continue
          const prev = l[e.id]
          next[e.id] = Array.from({ length: e.sets }, (_, i) => ({ kg: prev?.[i]?.kg ?? prev?.[0]?.kg ?? null, reps: null }))
        }
        return next
      })
    })
  }, [w])

  const persist = (c: string[], s: Record<string, SetLog[]>) => {
    try { sessionStorage.setItem(key, JSON.stringify({ checked: c, sets: s })) } catch { /* ignore */ }
  }
  const toggle = (id: string) => {
    const n = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]
    setChecked(n)
    persist(n, sets)
  }
  const setVal = (id: string, i: number, k: keyof SetLog, v: string) => {
    const num = v === '' ? null : Number(v.replace(',', '.'))
    const n = { ...sets, [id]: (sets[id] ?? []).map((s, j) => (j === i ? { ...s, [k]: num } : s)) }
    setSets(n)
    const c = (n[id] ?? []).every((s) => s.reps) && !checked.includes(id) ? [...checked, id] : checked
    if (c !== checked) setChecked(c)
    persist(c, n)
  }

  async function finish() {
    const elapsed = Math.round((Date.now() - start) / 60000)
    const duration = Number(mins) || (elapsed > 5 ? elapsed : w.minutes)
    const { error } = await supabase.from('workout_logs').insert({
      title: w.title,
      duration_min: duration,
      ...(past ? { done_at: new Date(past.getFullYear(), past.getMonth(), past.getDate(), 18).toISOString() } : {}),
      exercises: w.exercises.map((e) => ({ id: e.id, name: e.name, done: checked.includes(e.id), sets: (sets[e.id] ?? []).filter((s) => s.reps || s.kg) })),
    })
    if (error) return toast(error.message)
    try { sessionStorage.removeItem(key) } catch { /* ignore */ }
    toast('Workout logged 💪')
    onDone()
  }
  return (
    <Sheet title={w.title} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>{WEEKDAYS_LONG[w.weekday]} · {w.focus} · rest ~60 s between sets. Warm up 5 min first. Log weight and reps to get progression tips next time.</p>
      <div className="card" style={{ padding: '6px 14px' }}>
        {w.exercises.map((e) => {
          const tip = suggestion(e, last[e.id])
          const rows = sets[e.id]
          const bw = BODYWEIGHT.has(e.id)
          return (
            <div key={e.id} className="ex-row">
              <div className="row" style={{ gap: 12 }}>
                <CheckBox on={checked.includes(e.id)} onClick={() => toggle(e.id)} label={e.name} />
                <div>
                  <div style={{ fontWeight: 600 }}>{e.name}</div>
                  <div className="small num" style={{ color: 'var(--accent)' }}>{e.sets > 1 ? `${e.sets} × ${e.reps}` : e.reps}</div>
                </div>
              </div>
              {guideFor(e.id) ? (
                <button className="ex-thumb" onClick={() => setGuide(e.id)} aria-label={`How to do ${e.name}`}>
                  <ExerciseFigure anim={guideFor(e.id)!.anim} gear={EXERCISES.find((x) => x.id === e.id)?.needs} size={72} />
                  <span>How to</span>
                </button>
              ) : <div />}
              <div className="cue" style={{ paddingLeft: 38 }}>{e.cue}</div>
              {tip && <div className="cue" style={{ paddingLeft: 38, color: 'var(--text)' }}>↗ {tip}</div>}
              {rows && (
                <div style={{ gridColumn: '1 / -1', paddingLeft: 38 }}>
                  {rows.map((r, i) => (
                    <div key={i} className="set-row">
                      <span className="small muted num">Set {i + 1}</span>
                      {!bw && <input className="input" inputMode="decimal" placeholder="kg" aria-label={`${e.name} set ${i + 1} weight`} value={r.kg ?? ''} onChange={(ev) => setVal(e.id, i, 'kg', ev.target.value)} />}
                      <input className="input" inputMode="numeric" placeholder={last[e.id]?.[i]?.reps ? `${last[e.id][i].reps} last` : 'reps'} aria-label={`${e.name} set ${i + 1} reps`} value={r.reps ?? ''} onChange={(ev) => setVal(e.id, i, 'reps', ev.target.value)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <label className="field"><span>Duration (min)</span>
        <input className="input" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} />
      </label>
      <button className="btn block" onClick={finish}>{isToday ? 'Finish workout ✓' : past ? 'Log as done on this day' : 'Log as done today'}</button>
      {guide && <ExerciseGuide id={guide} onClose={() => setGuide(null)} />}
    </Sheet>
  )
}

const ACTIVITIES = ['Walk', 'Run', 'Cycling', 'Swimming', 'Football', 'Hiking', 'Yoga', 'Gym (own plan)']
const MORE_ACTIVITIES = [
  'Walk, brisk', 'Walking the dog', 'Run, easy', 'Run, intervals', 'Trail run', 'Treadmill', 'Indoor cycling / spinning', 'Mountain biking', 'E-bike ride',
  'Swimming, laps', 'Basketball', 'Tennis', 'Padel', 'Badminton', 'Table tennis', 'Volleyball', 'Handball', 'Boxing', 'Kickboxing', 'Martial arts', 'Climbing / bouldering',
  'Pilates', 'Stretching / mobility', 'HIIT', 'Circuit training', 'Crossfit', 'Rowing machine', 'Elliptical', 'Stair climber', 'Jump rope', 'Dancing',
  'Skiing', 'Snowboarding', 'Ice skating', 'Inline skating', 'Golf', 'Gardening', 'Cleaning the house', 'Moving furniture',
  'Gym: upper body', 'Gym: lower body', 'Gym: full body', 'Gym: push', 'Gym: pull', 'Gym: legs', 'Core / abs', 'Calisthenics',
]
const allActivities = () => [...new Set([...ACTIVITIES, ...MORE_ACTIVITIES, ...EXERCISES.map((e) => e.name)])]

function OtherSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('Walk')
  const [mins, setMins] = useState('30')
  const [when, setWhen] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  async function save() {
    const { error } = await supabase.from('workout_logs').insert({ title, duration_min: Number(mins) || null, done_at: new Date(when).toISOString() })
    if (error) return toast(error.message)
    toast(`${title} logged ✓`)
    onDone()
  }
  return (
    <Sheet title="Log activity" onClose={onClose}>
      <div className="chips" style={{ marginBottom: 14 }}>
        {ACTIVITIES.map((a) => <button key={a} className={'chip' + (title === a ? ' on' : '')} onClick={() => setTitle(a)}>{a}</button>)}
      </div>
      <label className="field"><span>Or type your own</span>
        <Autocomplete
          value={title}
          onChange={setTitle}
          suggest={(t) =>
            t.trim().length < 2 || ACTIVITIES.includes(t)
              ? []
              : allActivities()
                  .map((a) => ({ a, s: matchScore(a, t) }))
                  .filter((x) => x.s > 0 && x.a !== t)
                  .sort((x, y) => y.s - x.s)
                  .slice(0, 6)
                  .map(({ a }) => ({ key: a, label: a, onPick: () => setTitle(a) }))
          }
        />
      </label>
      <div className="grid2">
        <label className="field"><span>Minutes</span><input className="input" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} /></label>
        <label className="field"><span>When</span><input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
      </div>
      <button className="btn block" onClick={save}>Save</button>
    </Sheet>
  )
}

function LogSheet({ log, onClose, onDeleted }: { log: WorkoutLog; onClose: () => void; onDeleted: () => void }) {
  const [guide, setGuide] = useState<string | null>(null)
  const ex = (Array.isArray(log.exercises) ? log.exercises : []) as { id: string; name: string; done?: boolean; sets?: SetLog[] }[]
  const del = async () => {
    if (!confirm('Delete this entry?')) return
    await supabase.from('workout_logs').delete().eq('id', log.id)
    onDeleted()
  }
  return (
    <Sheet title={log.title} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        {new Date(log.done_at).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        {log.duration_min ? ` · ${log.duration_min} min` : ''}
      </p>
      {ex.length > 0 && (
        <div className="card" style={{ padding: '6px 14px' }}>
          {ex.map((e) => {
            const g = guideFor(e.id)
            return (
              <div key={e.id} className="list-item">
                {g ? (
                  <button className="ex-thumb" onClick={() => setGuide(e.id)} aria-label={`How to do ${e.name}`}>
                    <ExerciseFigure anim={g.anim} gear={EXERCISES.find((x) => x.id === e.id)?.needs} size={56} />
                  </button>
                ) : null}
                <div className="grow">
                  <div className="title" style={{ opacity: e.done ? 1 : 0.5 }}>{e.done ? '✓ ' : ''}{e.name}</div>
                  {e.sets?.length ? <div className="small muted num">{e.sets.map((st) => (st.kg ? `${st.kg} kg × ${st.reps ?? '–'}` : `${st.reps ?? '–'} reps`)).join(' · ')}</div> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <button className="btn danger block" onClick={del}>Delete entry</button>
      {guide && <ExerciseGuide id={guide} onClose={() => setGuide(null)} />}
    </Sheet>
  )
}
