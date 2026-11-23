import { useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { ACTIVITY, computeTargets } from '../lib/calc'
import type { Activity, Profile, Sex } from '../lib/types'
import { Chips, Seg } from '../components/ui'
import { DIET_TAGS, INGREDIENT_NAMES } from '../data/recipes'
import ListInput from '../components/ListInput'
import { EQUIPMENT, generateWorkoutPlan } from '../data/exercises'
import { isoDate } from '../lib/dates'

const STEPS = 5

export default function Onboarding() {
  const { profile, saveProfile } = useStore()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [p, setP] = useState<Partial<Profile>>({
    display_name: profile?.display_name ?? '',
    sex: profile?.sex ?? null,
    birth_year: profile?.birth_year ?? null,
    height_cm: profile?.height_cm ?? null,
    start_weight_kg: profile?.start_weight_kg ?? null,
    target_weight_kg: profile?.target_weight_kg ?? null,
    activity_level: profile?.activity_level ?? 'light',
    weekly_loss_kg: profile?.weekly_loss_kg ?? 0.5,
    diet_tags: profile?.diet_tags ?? [],
    avoid_foods: profile?.avoid_foods ?? '',
    cook_time_min: profile?.cook_time_min ?? 30,
    equipment: profile?.equipment ?? [],
    training_days: profile?.training_days ?? 3,
    session_minutes: profile?.session_minutes ?? 45,
  })
  const set = <K extends keyof Profile>(k: K, v: Profile[K] | null) => setP((x) => ({ ...x, [k]: v }))
  const num = (v: string) => (v === '' ? null : Number(v.replace(',', '.')))

  const valid = [
    true,
    !!p.sex && !!p.birth_year && !!p.height_cm,
    !!p.start_weight_kg && !!p.target_weight_kg,
    true,
    true,
  ][step]

  const targets = computeTargets(p)

  async function finish() {
    setBusy(true)
    setErr(null)
    try {
      const plan = generateWorkoutPlan(p.equipment ?? [], p.training_days ?? 3, p.session_minutes ?? 45)
      await supabase.from('workout_plans').update({ is_active: false }).eq('is_active', true)
      await supabase.from('workout_plans').insert({ plan, is_active: true })
      if (p.start_weight_kg) {
        await supabase.from('weight_logs').upsert({ logged_on: isoDate(), weight_kg: p.start_weight_kg }, { onConflict: 'user_id,logged_on' })
      }
      await saveProfile({ ...p, kcal_target: targets.kcal, protein_target_g: targets.protein, onboarded: true })
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="app" style={{ paddingBottom: 40 }}>
      <div className="steps">{Array.from({ length: STEPS }, (_, i) => <div key={i} className={i <= step ? 'on' : ''} />)}</div>

      {step === 0 && (
        <>
          <h1 style={{ fontSize: 28, margin: '0 0 6px' }}>Welcome 👋</h1>
          <p className="muted">A few questions so your calorie goal, meal plan and workouts fit you. Takes about a minute, and you can change everything later.</p>
          <label className="field" style={{ marginTop: 20 }}>
            <span>What should we call you?</span>
            <input className="input" value={p.display_name ?? ''} onChange={(e) => set('display_name', e.target.value)} placeholder="Your name" />
          </label>
        </>
      )}

      {step === 1 && (
        <>
          <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>About you</h1>
          <label className="field"><span>Sex (for the calorie formula)</span>
            <Seg<Sex> options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }, { id: 'other', label: 'Other' }]} value={(p.sex ?? '') as Sex} onChange={(v) => set('sex', v)} />
          </label>
          <div className="grid2">
            <label className="field"><span>Year of birth</span>
              <input className="input" inputMode="numeric" value={p.birth_year ?? ''} onChange={(e) => set('birth_year', num(e.target.value))} placeholder="1995" />
            </label>
            <label className="field"><span>Height (cm)</span>
              <input className="input" inputMode="decimal" value={p.height_cm ?? ''} onChange={(e) => set('height_cm', num(e.target.value))} placeholder="180" />
            </label>
          </div>
          <label className="field"><span>Everyday activity (without workouts)</span>
            <div className="stack">
              {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
                <button key={a} type="button" className={'chip' + (p.activity_level === a ? ' on' : '')} style={{ width: '100%', textAlign: 'left', borderRadius: 14, padding: '10px 14px' }} onClick={() => set('activity_level', a)}>
                  <div style={{ fontWeight: 600 }}>{ACTIVITY[a].label}</div>
                  <div className="small muted">{ACTIVITY[a].hint}</div>
                </button>
              ))}
            </div>
          </label>
        </>
      )}

      {step === 2 && (
        <>
          <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>Your goal 🎯</h1>
          <div className="grid2">
            <label className="field"><span>Current weight (kg)</span>
              <input className="input" inputMode="decimal" value={p.start_weight_kg ?? ''} onChange={(e) => set('start_weight_kg', num(e.target.value))} placeholder="95" />
            </label>
            <label className="field"><span>Target weight (kg)</span>
              <input className="input" inputMode="decimal" value={p.target_weight_kg ?? ''} onChange={(e) => set('target_weight_kg', num(e.target.value))} placeholder="80" />
            </label>
          </div>
          <label className="field"><span>Pace</span>
            <Seg<number> options={[{ id: 0.25, label: 'Gentle' }, { id: 0.5, label: 'Steady' }, { id: 0.75, label: 'Faster' }]} value={Number(p.weekly_loss_kg ?? 0.5)} onChange={(v) => set('weekly_loss_kg', v)} />
            <div className="small muted" style={{ marginTop: 6 }}>About {p.weekly_loss_kg} kg per week. Steady is easiest to keep up.</div>
          </label>
          {p.start_weight_kg && p.height_cm && (
            <div className="card" style={{ background: 'var(--accent-soft)', border: 'none' }}>
              <div className="small muted">Your daily target</div>
              <div style={{ fontSize: 30, fontWeight: 700 }} className="num">{targets.kcal} kcal</div>
              <div className="small">≈ {targets.protein} g protein · you burn about {targets.tdee} kcal a day</div>
              {p.target_weight_kg && p.start_weight_kg > p.target_weight_kg && (
                <div className="small muted" style={{ marginTop: 6 }}>
                  {Math.round((p.start_weight_kg - p.target_weight_kg) * 10) / 10} kg to go · roughly {Math.ceil((p.start_weight_kg - p.target_weight_kg) / Number(p.weekly_loss_kg || 0.5))} weeks
                </div>
              )}
            </div>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>Food 🍽️</h1>
          <label className="field"><span>Diet</span>
            <Chips options={DIET_TAGS} value={p.diet_tags ?? []} onChange={(v) => set('diet_tags', v)} />
          </label>
          <label className="field"><span>Foods you don’t eat (comma separated)</span>
            <ListInput value={p.avoid_foods ?? ''} onChange={(v) => set('avoid_foods', v)} options={INGREDIENT_NAMES} placeholder="e.g. mushrooms, salmon" />
          </label>
          <label className="field"><span>Max cooking time per meal</span>
            <Seg<number> options={[{ id: 15, label: '15 min' }, { id: 30, label: '30 min' }, { id: 45, label: '45+ min' }]} value={p.cook_time_min ?? 30} onChange={(v) => set('cook_time_min', v)} />
          </label>
        </>
      )}

      {step === 4 && (
        <>
          <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>Training 💪</h1>
          <label className="field"><span>Equipment you have (none is fine too)</span>
            <Chips options={EQUIPMENT.map((e) => ({ id: e.id, label: e.label }))} value={p.equipment ?? []} onChange={(v) => set('equipment', v)} />
          </label>
          <label className="field"><span>Workouts per week</span>
            <Seg<number> options={[2, 3, 4, 5, 6].map((n) => ({ id: n, label: String(n) }))} value={p.training_days ?? 3} onChange={(v) => set('training_days', v)} />
          </label>
          <label className="field"><span>Time per workout</span>
            <Seg<number> options={[20, 30, 45, 60].map((n) => ({ id: n, label: `${n} min` }))} value={p.session_minutes ?? 45} onChange={(v) => set('session_minutes', v)} />
          </label>
        </>
      )}

      {err && <p style={{ color: 'var(--warn)' }}>{err}</p>}
      <div className="row" style={{ marginTop: 24 }}>
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
        {step < STEPS - 1 ? (
          <button className="btn grow" disabled={!valid} onClick={() => setStep(step + 1)}>Continue</button>
        ) : (
          <button className="btn grow" disabled={busy} onClick={finish}>{busy ? 'Setting up…' : 'Let’s go'}</button>
        )}
      </div>
    </div>
  )
}
