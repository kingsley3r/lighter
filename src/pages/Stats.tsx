import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Seg, Sheet, useToast } from '../components/ui'
import { ProgressCard } from '../components/ProgressPhotos'
import { BarChart, LineChart, type Pt } from '../components/charts'
import { addDays, isoDate, startOfDay } from '../lib/dates'
import { mealsBetween, measurementsSince, sleepSince, sum, waterBetween, weightsSince, workoutsBetween, type Measurement } from '../lib/data'
import { estimateExpenditure, trendSeries } from '../lib/trend'
import { supabase } from '../lib/supabase'
import { macroTargets, round1 } from '../lib/calc'
import type { MealLog, SleepLog, WaterLog, WeightLog, WorkoutLog } from '../lib/types'

interface D { meals: MealLog[]; water: WaterLog[]; weights: WeightLog[]; sleep: SleepLog[]; workouts: WorkoutLog[]; allWeights: WeightLog[]; recentMeals: MealLog[]; measures: Measurement[] }

export default function Stats() {
  const { profile, version, bump } = useStore()
  const [measureOpen, setMeasureOpen] = useState(false)
  const [range, setRange] = useState<7 | 30 | 90>(7)
  const [d, setD] = useState<D | null>(null)

  useEffect(() => {
    const from = startOfDay(addDays(new Date(), -(range - 1)))
    const to = addDays(startOfDay(new Date()), 1)
    Promise.all([
      mealsBetween(from.toISOString(), to.toISOString()),
      waterBetween(from.toISOString(), to.toISOString()),
      weightsSince(isoDate(from)),
      sleepSince(isoDate(from)),
      workoutsBetween(from.toISOString(), to.toISOString()),
      weightsSince('1900-01-01'),
      mealsBetween(startOfDay(addDays(new Date(), -22)).toISOString(), startOfDay(new Date()).toISOString()),
      measurementsSince('1900-01-01'),
    ]).then(([meals, water, weights, sleep, workouts, allWeights, recentMeals, measures]) => setD({ meals, water, weights, sleep, workouts, allWeights, recentMeals, measures }))
  }, [range, version])

  const days = Array.from({ length: range }, (_, i) => addDays(startOfDay(new Date()), -(range - 1 - i)))
  const lbl = (x: Date) => (range === 7 ? x.toLocaleDateString('en-GB', { weekday: 'short' }) : `${x.getDate()}.${x.getMonth() + 1}`)
  const byDay = <T,>(arr: T[], getDate: (x: T) => string, val: (x: T) => number): Pt[] =>
    days.map((day) => {
      const k = isoDate(day)
      const items = arr.filter((x) => getDate(x) === k)
      return { x: k, label: lbl(day), y: items.length ? sum(items, val) : null }
    })
  const localDay = (s: string) => isoDate(new Date(s))

  if (!d || !profile) return (<><header className="page-head"><h1>Stats</h1></header><div className="empty">Loading…</div></>)

  const kcal = byDay(d.meals, (m) => localDay(m.eaten_at), (m) => m.kcal)
  const water = byDay(d.water, (w) => localDay(w.logged_at), (w) => w.amount_ml)
  const sleep = byDay(d.sleep, (s) => s.night_of, (s) => Number(s.hours))
  const weight = days.map((day) => {
    const w = d.weights.find((x) => x.logged_on === isoDate(day))
    return { x: isoDate(day), label: lbl(day), y: w ? Number(w.weight_kg) : null }
  })
  const minutes = byDay(d.workouts, (w) => localDay(w.done_at), (w) => w.duration_min ?? 30)

  const avg = (pts: Pt[]) => {
    const v = pts.map((p) => p.y).filter((x): x is number => x != null)
    return v.length ? sum(v, (x) => x) / v.length : null
  }
  const wv = d.weights.map((w) => Number(w.weight_kg))
  const change = wv.length >= 2 ? round1(wv[wv.length - 1] - wv[0]) : null
  const latest = d.allWeights.length ? Number(d.allWeights[d.allWeights.length - 1].weight_kg) : null
  const totalLost = latest != null && profile.start_weight_kg ? round1(profile.start_weight_kg - latest) : null
  const toGoal = latest != null && profile.target_weight_kg ? round1(latest - profile.target_weight_kg) : null
  const progress = profile.start_weight_kg && profile.target_weight_kg && latest != null
    ? Math.max(0, Math.min(1, (profile.start_weight_kg - latest) / (profile.start_weight_kg - profile.target_weight_kg)))
    : 0
  const trend = trendSeries(d.allWeights)
  const trendPts = days.map((day) => trend.get(isoDate(day)) ?? null)
  const tv = trendPts.filter((v): v is number => v != null)
  const trendChange = tv.length >= 2 ? round1(tv[tv.length - 1] - tv[0]) : null
  const dailyKcal = new Map<string, number>()
  for (const m of d.recentMeals) {
    const k = localDay(m.eaten_at)
    dailyKcal.set(k, (dailyKcal.get(k) ?? 0) + m.kcal)
  }
  const exp = estimateExpenditure(dailyKcal, trend)
  const avgKcal = avg(kcal)
  const onTarget = kcal.filter((p) => p.y != null && p.y <= (profile.kcal_target ?? 2000) * 1.05).length
  const logged = kcal.filter((p) => p.y != null).length

  return (
    <>
      <header className="page-head"><h1>Stats</h1></header>
      <div style={{ marginBottom: 14 }}>
        <Seg<7 | 30 | 90> options={[{ id: 7, label: '7 days' }, { id: 30, label: '30 days' }, { id: 90, label: '90 days' }]} value={range} onChange={setRange} />
      </div>

      <section className="card">
        <div className="card-head"><h2>Journey</h2><span className="pill accent">{Math.round(progress * 100)} %</span></div>
        <div className="bar" style={{ height: 10 }}><div style={{ width: `${progress * 100}%`, background: 'var(--accent)' }} /></div>
        <div className="row between small muted" style={{ marginTop: 6 }}>
          <span>{profile.start_weight_kg} kg</span>
          <span>{profile.target_weight_kg} kg</span>
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <Tile v={totalLost != null ? `${totalLost > 0 ? '−' : ''}${Math.abs(totalLost)} kg` : '—'} l="Lost so far" />
          <Tile v={toGoal != null ? `${Math.max(0, toGoal)} kg` : '—'} l="To goal" />
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Weight</h2><span className="small muted num">{trendChange != null ? `trend ${trendChange > 0 ? '+' : ''}${trendChange} kg in ${range} d` : change != null ? `${change > 0 ? '+' : ''}${change} kg in ${range} d` : ''}</span></div>
        <LineChart data={weight} color="var(--accent)" target={profile.target_weight_kg} unit=" kg" trend={tv.length >= 2 ? trendPts : undefined} />
        {tv.length >= 2 && <p className="small muted" style={{ marginBottom: 0 }}>Line = smoothed trend, circles = daily weigh-ins. Water and salt make single days jump; the trend shows real fat loss.</p>}
      </section>

      <SmartTarget exp={exp} onApplied={bump} />

      <ProgressCard />

      <section className="card">
        <div className="card-head"><h2>Body measurements</h2><button className="btn ghost sm" onClick={() => setMeasureOpen(true)}>+ Log</button></div>
        <Measurements list={d.measures} />
      </section>

      <section className="card">
        <div className="card-head"><h2>Calories</h2><span className="small muted num">{avgKcal != null ? `avg ${Math.round(avgKcal)} kcal` : ''}</span></div>
        <BarChart data={kcal} color="var(--protein)" target={profile.kcal_target} unit=" kcal" />
        {logged > 0 && <p className="small muted" style={{ marginBottom: 0 }}>On target {onTarget} of {logged} logged days. Dashed line = your goal.</p>}
      </section>

      <div className="grid2">
        <Tile v={avg(water) != null ? `${(avg(water)! / 1000).toFixed(1)} L` : '—'} l="Avg water / day" />
        <Tile v={avg(sleep) != null ? `${round1(avg(sleep)!)} h` : '—'} l="Avg sleep" />
        <Tile v={String(d.workouts.length)} l={`Workouts in ${range} d`} />
        <Tile v={String(sum(d.workouts, (w) => w.duration_min ?? 0))} l="Active minutes" />
      </div>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="card-head"><h2>💧 Water</h2></div>
        <BarChart data={water} color="var(--water)" target={profile.water_target_ml} unit=" ml" />
      </section>

      <section className="card">
        <div className="card-head"><h2>Sleep</h2></div>
        <BarChart data={sleep} color="var(--sleep)" target={Number(profile.sleep_target_h ?? 8)} unit=" h" />
      </section>

      <section className="card">
        <div className="card-head"><h2>Workouts</h2></div>
        <BarChart data={minutes} color="var(--accent)" unit=" min" />
        {d.workouts.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {[...d.workouts].reverse().slice(0, 6).map((w) => (
              <div key={w.id} className="list-item">
                <div className="grow">{w.title}</div>
                <div className="small muted">{new Date(w.done_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{w.duration_min ? ` · ${w.duration_min} min` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      {measureOpen && <MeasureSheet last={d.measures[d.measures.length - 1]} onClose={() => setMeasureOpen(false)} onSaved={bump} />}
    </>
  )
}

function SmartTarget({ exp, onApplied }: { exp: ReturnType<typeof estimateExpenditure>; onApplied: () => void }) {
  const { profile, saveProfile } = useStore()
  const toast = useToast()
  if (!profile) return null
  const kcalNow = profile.kcal_target ?? 2000
  if (!exp) {
    return (
      <section className="card">
        <div className="card-head"><h2>Smart calorie target</h2><span className="pill">learning</span></div>
        <p className="small muted" style={{ margin: 0 }}>Log your food on most days and weigh in a few times a week. After about 2 weeks Lighter calculates how many calories you really burn and suggests a better target.</p>
      </section>
    )
  }
  const pace = Number(profile.weekly_loss_kg ?? 0.5)
  const floor = profile.sex === 'female' ? 1200 : 1500
  const suggested = Math.max(floor, Math.round((exp.tdee - (pace * 7700) / 7) / 10) * 10)
  const diff = suggested - kcalNow
  const apply = async () => {
    try {
      await saveProfile({ kcal_target: suggested })
      onApplied()
      toast(`Target set to ${suggested} kcal ✓`)
    } catch (e) {
      toast((e as Error).message)
    }
  }
  const m = macroTargets(suggested, profile.protein_target_g ?? 120)
  return (
    <section className="card">
      <div className="card-head"><h2>Smart calorie target</h2><span className="pill accent">{exp.loggedDays} days of data</span></div>
      <div className="grid2">
        <div className="stat-tile"><div className="v num">{exp.tdee}</div><div className="l">kcal you really burn / day</div></div>
        <div className="stat-tile"><div className="v num">{exp.weeklyChange > 0 ? '+' : ''}{exp.weeklyChange} kg</div><div className="l">trend per week</div></div>
      </div>
      <p className="small muted">You ate {exp.avgIntake} kcal on average. To lose {pace} kg a week, aim for <b className="num">{suggested} kcal</b> (P {m.protein} · C {m.carbs} · F {m.fat} g).</p>
      {Math.abs(diff) >= 50 ? (
        <button className="btn block" onClick={apply}>Update target {diff > 0 ? '+' : '−'}{Math.abs(diff)} kcal</button>
      ) : (
        <p className="small" style={{ color: 'var(--accent)', margin: 0 }}>Your current target fits. Keep going ✓</p>
      )}
    </section>
  )
}

const FIELDS: { k: keyof Measurement; label: string }[] = [
  { k: 'waist_cm', label: 'Waist' },
  { k: 'hips_cm', label: 'Hips' },
  { k: 'chest_cm', label: 'Chest' },
  { k: 'arm_cm', label: 'Upper arm' },
  { k: 'thigh_cm', label: 'Thigh' },
  { k: 'body_fat_pct', label: 'Body fat %' },
]

function Measurements({ list }: { list: Measurement[] }) {
  if (!list.length) return <p className="small muted" style={{ margin: 0 }}>Measure your waist every 2 weeks. It often drops even when the scale is stuck.</p>
  const first = list[0]
  const last = list[list.length - 1]
  const rows = FIELDS.filter((f) => last[f.k] != null)
  return (
    <div>
      {rows.map((f) => {
        const a = first[f.k] as number | null
        const b = last[f.k] as number
        const delta = a != null && first !== last ? round1(b - a) : null
        return (
          <div key={f.k} className="list-item">
            <div className="grow">{f.label}</div>
            <div className="num" style={{ fontWeight: 600 }}>{b}{f.k === 'body_fat_pct' ? ' %' : ' cm'}</div>
            {delta != null && <span className={'pill' + (delta < 0 ? ' accent' : '')}>{delta > 0 ? '+' : ''}{delta}</span>}
          </div>
        )
      })}
      <p className="small muted" style={{ marginBottom: 0 }}>Last measured {new Date(last.measured_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{first !== last ? `, change since ${new Date(first.measured_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}.</p>
    </div>
  )
}

function MeasureSheet({ last, onClose, onSaved }: { last?: Measurement; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.k, last?.[f.k] != null ? String(last[f.k]) : ''])))
  const save = async () => {
    const row: Record<string, number | null | string> = { measured_on: isoDate() }
    for (const f of FIELDS) row[f.k] = v[f.k] ? Number(v[f.k].replace(',', '.')) || null : null
    const { error } = await supabase.from('body_measurements').upsert(row as never, { onConflict: 'user_id,measured_on' })
    if (error) return toast(error.message)
    toast('Measurements saved ✓')
    onSaved()
    onClose()
  }
  return (
    <Sheet title="Body measurements" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>Measure in the morning, tape snug but not tight. Waist: at the belly button. Leave fields empty that you don’t track.</p>
      <div className="grid2">
        {FIELDS.map((f) => (
          <label key={f.k} className="field"><span>{f.label}{f.k === 'body_fat_pct' ? '' : ' (cm)'}</span>
            <input className="input" inputMode="decimal" value={v[f.k]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
          </label>
        ))}
      </div>
      <button className="btn block" onClick={save}>Save</button>
    </Sheet>
  )
}

function Tile({ v, l }: { v: string; l: string }) {
  return (
    <div className="stat-tile"><div className="v num">{v}</div><div className="l">{l}</div></div>
  )
}
