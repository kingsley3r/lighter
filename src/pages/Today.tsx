import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import type { Tab } from '../App'
import { Bar, Ring, Seg, Sheet, useToast } from '../components/ui'
import AddMeal from '../components/AddMeal'
import FastingCard from '../components/Fasting'
import DrinkSheet from '../components/DrinkSheet'
import { WeeklyCard, WeeklySheet } from '../components/WeeklyCheckin'
import { HealthSheet, StepsCard } from '../components/Steps'
import FriendsSheet, { FriendsCard } from '../components/Friends'
import Coach from '../components/Coach'
import PlateauCard, { RefeedBanner } from '../components/Plateau'
import { MorningCard, MorningSheet } from '../components/Morning'
import { MOODS } from '../lib/insights'
import { HabitsCard } from '../components/Habits'
import { addDays, fmtDay, fmtTime, isoDate, weekdayIdx } from '../lib/dates'
import { activeWorkoutPlan, addWater, dayRange, latestWeight, loggingStreak, mealsBetween, setSleep, setWeight, sleepSince, sum, waterBetween, workoutsBetween } from '../lib/data'
import { macroTargets, round1 } from '../lib/calc'
import { supabase } from '../lib/supabase'
import type { MealLog, PlannedWorkout, SleepLog, WaterLog, WeightLog, WorkoutLog } from '../lib/types'

export default function Today({ go }: { go: (t: Tab) => void }) {
  const { profile, version, bump } = useStore()
  const toast = useToast()
  const [meals, setMeals] = useState<MealLog[]>([])
  const [water, setWater] = useState<WaterLog[]>([])
  const [weight, setW] = useState<WeightLog | null>(null)
  const [sleep, setSl] = useState<SleepLog | null>(null)
  const [workout, setWorkout] = useState<PlannedWorkout | null>(null)
  const [doneToday, setDoneToday] = useState<WorkoutLog[]>([])
  const [sheet, setSheet] = useState<null | 'meal' | 'weight' | 'sleep' | 'drink' | 'weekly' | 'health' | 'friends' | 'coach'>(null)
  const [streak, setStreak] = useState(0)

  const load = useCallback(async () => {
    const r = dayRange(new Date())
    const [m, w, lw, sl, plan, wl] = await Promise.all([
      mealsBetween(r.from, r.to),
      waterBetween(r.from, r.to),
      latestWeight(),
      sleepSince(isoDate()),
      activeWorkoutPlan(),
      workoutsBetween(r.from, r.to),
    ])
    setMeals(m)
    setWater(w)
    setW(lw)
    setSl(sl[0] ?? null)
    setWorkout(plan?.workouts.find((x) => x.weekday === weekdayIdx(new Date())) ?? null)
    setDoneToday(wl)
    loggingStreak().then(setStreak)
  }, [])

  useEffect(() => {
    load()
  }, [load, version])

  if (!profile) return null
  const kcalT = profile.kcal_target ?? 2000
  const macros = macroTargets(kcalT, profile.protein_target_g ?? 120)
  const eaten = sum(meals, (m) => m.kcal)
  const left = kcalT - eaten
  const waterMl = sum(water, (w) => w.amount_ml)
  const waterT = profile.water_target_ml ?? 2500
  const hour = new Date().getHours()
  const greet = hour < 11 ? 'Good morning' : hour < 18 ? 'Hello' : 'Good evening'

  const drink = async (ml: number) => {
    const { error } = await addWater(ml)
    if (error) return toast(error.message)
    load()
  }
  const undoWater = async () => {
    const last = water[water.length - 1]
    if (!last) return
    await supabase.from('water_logs').delete().eq('id', last.id)
    load()
  }
  const removeMeal = async (id: number) => {
    await supabase.from('meal_logs').delete().eq('id', id)
    load()
  }

  const toGo = weight && profile.target_weight_kg ? round1(weight.weight_kg - profile.target_weight_kg) : null
  const lost = weight && profile.start_weight_kg ? round1(profile.start_weight_kg - weight.weight_kg) : null

  return (
    <>
      <header className="page-head">
        <div>
          <div className="sub">{fmtDay(new Date())}</div>
          <h1>{greet}{profile.display_name ? `, ${profile.display_name}` : ''}</h1>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {streak > 1 && <span className="pill accent" title="Days in a row with something logged">🔥 {streak}</span>}
          <button className="btn ghost sm" onClick={() => setSheet('coach')}>💬 Ask Pip</button>
        </div>
      </header>

      <RefeedBanner />
      <MorningCard logged={!!sleep} onOpen={() => setSheet('sleep')} />
      <WeeklyCard onOpen={() => setSheet('weekly')} />
      <PlateauCard dismissible onTrain={() => go('train')} />
      <FriendsCard onOpen={() => setSheet('friends')} />

      <section className="card">
        <div className="row" style={{ gap: 18 }}>
          <Ring value={eaten} max={kcalT} color={left < 0 ? 'var(--warn)' : 'var(--accent)'}>
            <div className="big num">{Math.abs(left)}</div>
            <div className="small muted">{left >= 0 ? 'kcal left' : 'kcal over'}</div>
          </Ring>
          <div className="grow stack">
            <MacroRow label="Protein" v={sum(meals, (m) => m.protein_g)} t={macros.protein} color="var(--protein)" />
            <MacroRow label="Carbs" v={sum(meals, (m) => m.carbs_g)} t={macros.carbs} color="var(--carbs)" />
            <MacroRow label="Fat" v={sum(meals, (m) => m.fat_g)} t={macros.fat} color="var(--fat)" />
            <div className="small muted num">{eaten} / {kcalT} kcal</div>
          </div>
        </div>
        <button className="btn block" style={{ marginTop: 14 }} onClick={() => setSheet('meal')}>+ Log food</button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>💧 Water</h2>
          <span className="num muted small">{(waterMl / 1000).toFixed(2)} / {(waterT / 1000).toFixed(1)} L</span>
        </div>
        <Bar value={waterMl} max={waterT} color="var(--water)" />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn ghost grow sm" onClick={() => drink(250)}>+ Glass 250 ml</button>
          <button className="btn ghost grow sm" onClick={() => drink(500)}>+ Bottle 500 ml</button>
          {water.length > 0 && <button className="btn ghost sm" onClick={undoWater} aria-label="Undo last water entry">Undo</button>}
        </div>
        <button className="link" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => setSheet('drink')}>+ Other drink (coffee, juice, soda…)</button>
      </section>

      <StepsCard onHealth={() => setSheet('health')} />
      <HabitsCard />

      <section className="card">
        <div className="card-head">
          <h2>Today’s workout</h2>
          {doneToday.length > 0 && <span className="pill accent">Done ✓</span>}
        </div>
        {workout ? (
          <div className="row between">
            <div>
              <div className="title" style={{ fontWeight: 600 }}>{workout.title}</div>
              <div className="small muted">{workout.exercises.length} exercises · ~{workout.minutes} min</div>
            </div>
            <button className="btn sm outline" onClick={() => go('train')}>{doneToday.length ? 'View' : 'Start'}</button>
          </div>
        ) : (
          <div className="row between">
            <div className="muted small">Rest day. A walk still counts 🚶</div>
            <button className="btn sm ghost" onClick={() => go('train')}>Plan</button>
          </div>
        )}
      </section>

      <FastingCard />

      <div className="grid2">
        <button className="card" style={{ textAlign: 'left', cursor: 'pointer', margin: 0 }} onClick={() => setSheet('weight')}>
          <div className="small muted">Weight</div>
          <div style={{ fontSize: 24, fontWeight: 700 }} className="num">{weight ? `${weight.weight_kg} kg` : '—'}</div>
          <div className="small muted">
            {weight?.logged_on === isoDate() ? 'today' : 'tap to log today'}
            {lost != null && lost > 0 ? ` · −${lost} kg` : ''}
          </div>
          {toGo != null && toGo > 0 && <div className="small" style={{ color: 'var(--accent)', marginTop: 2 }}>{toGo} kg to goal</div>}
        </button>
        <button className="card" style={{ textAlign: 'left', cursor: 'pointer', margin: 0 }} onClick={() => setSheet('sleep')}>
          <div className="small muted">Sleep last night</div>
          <div style={{ fontSize: 24, fontWeight: 700 }} className="num">{sleep ? `${sleep.hours} h` : '—'}{sleep?.mood ? <span style={{ fontSize: 18, marginLeft: 6 }}>{MOODS[sleep.mood - 1]}</span> : null}</div>
          <div className="small muted">{sleep ? `goal ${profile.sleep_target_h ?? 8} h` : 'tap to log'}</div>
        </button>
      </div>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="card-head"><h2>Eaten today</h2></div>
        {meals.length === 0 ? (
          <div className="empty">Nothing logged yet. Snap a photo of your next meal 📷</div>
        ) : (
          meals.map((m) => (
            <div key={m.id} className="list-item">
              <div className="grow">
                <div className="title">{m.name}</div>
                <div className="small muted">{fmtTime(m.eaten_at)} · {m.meal_type ?? 'meal'} · P {Math.round(m.protein_g)} · C {Math.round(m.carbs_g)} · F {Math.round(m.fat_g)}</div>
              </div>
              <div className="num" style={{ fontWeight: 600 }}>{m.kcal}</div>
              <button className="btn ghost sm icon" aria-label={`Delete ${m.name}`} onClick={() => removeMeal(m.id)}>✕</button>
            </div>
          ))
        )}
      </section>

      {sheet === 'meal' && <AddMeal onClose={() => setSheet(null)} onSaved={() => { load(); bump() }} />}
      {sheet === 'weight' && <WeightSheet current={weight?.weight_kg ?? profile.start_weight_kg ?? 80} onClose={() => setSheet(null)} onSaved={() => { load(); bump() }} />}
      {sheet === 'drink' && <DrinkSheet onClose={() => setSheet(null)} onSaved={() => { load(); bump() }} />}
      {sheet === 'coach' && <Coach onClose={() => setSheet(null)} name={(() => { try { return localStorage.getItem('pet-name') || 'Pip' } catch { return 'Pip' } })()} level={(() => { try { return Number(localStorage.getItem('pip-level') || 4) } catch { return 4 } })()} />}
      {sheet === 'friends' && <FriendsSheet onClose={() => { setSheet(null); bump() }} />}
      {sheet === 'health' && <HealthSheet onClose={() => setSheet(null)} />}
      {sheet === 'weekly' && <WeeklySheet onClose={() => setSheet(null)} onDone={bump} />}
      {sheet === 'sleep' && <MorningSheet current={sleep} onClose={() => setSheet(null)} onSaved={() => { load(); bump() }} />}
    </>
  )
}

function MacroRow({ label, v, t, color }: { label: string; v: number; t: number; color: string }) {
  return (
    <div>
      <div className="row between small"><span>{label}</span><span className="num muted">{Math.round(v)} / {t} g</span></div>
      <Bar value={v} max={t} color={color} />
    </div>
  )
}

function WeightSheet({ current, onClose, onSaved }: { current: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [v, setV] = useState(String(current))
  const [day, setDay] = useState<'today' | 'yesterday'>('today')
  const save = async () => {
    const kg = Number(v.replace(',', '.'))
    if (!kg) return
    const { error } = await setWeight(isoDate(day === 'today' ? new Date() : addDays(new Date(), -1)), kg)
    if (error) return toast(error.message)
    toast('Weight saved ✓')
    onSaved()
    onClose()
  }
  const step = (d: number) => setV(String(round1((Number(v.replace(',', '.')) || 0) + d)))
  return (
    <Sheet title="Log weight" onClose={onClose}>
      <Seg options={[{ id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }]} value={day} onChange={setDay} />
      <div className="row" style={{ margin: '18px 0', justifyContent: 'center' }}>
        <button className="btn ghost icon" onClick={() => step(-0.1)} aria-label="Minus 0.1 kg">−</button>
        <input className="input num" style={{ width: 130, textAlign: 'center', fontSize: 28, fontWeight: 700 }} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn ghost icon" onClick={() => step(0.1)} aria-label="Plus 0.1 kg">+</button>
        <span className="muted">kg</span>
      </div>
      <p className="small muted">Tip: weigh yourself in the morning after the bathroom, before eating. Daily ups and downs are normal; the trend is what counts.</p>
      <button className="btn block" onClick={save}>Save</button>
    </Sheet>
  )
}

