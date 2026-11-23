import { useEffect, useState } from 'react'
import { useStore, useTheme } from '../store'
import { Chips, Seg, Sheet, useToast } from '../components/ui'
import { ACTIVITY, age, bmi, computeTargets, round1 } from '../lib/calc'
import { latestWeight } from '../lib/data'
import { DIET_TAGS, INGREDIENT_NAMES } from '../data/recipes'
import ListInput from '../components/ListInput'
import { EQUIPMENT, generateWorkoutPlan } from '../data/exercises'
import { supabase } from '../lib/supabase'
import { fastingVisible } from '../components/Fasting'
import type { Activity, Profile, Sex } from '../lib/types'
import { PetFigure, TrophySheet } from '../components/Pet'
import { RemindersSheet } from '../components/Reminders'
import { levelFor, usePipStats } from '../lib/pip'
import { macroTargets } from '../lib/calc'

function TrophyCard() {
  const { profile, version } = useStore()
  const kcal = profile?.kcal_target ?? 2000
  const stats = usePipStats(version, kcal, macroTargets(kcal, profile?.protein_target_g ?? 120).protein)
  const [open, setOpen] = useState(false)
  const name = (() => { try { return localStorage.getItem('pet-name') || 'Pip' } catch { return 'Pip' } })()
  if (!stats) return null
  const lv = levelFor(stats.xp)
  const done = stats.trophies.filter((t) => t.value >= t.goal)
  return (
    <section className="card trophy-card" onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
      <PetFigure mood="happy" level={lv.lvl} eating={false} flex size={72} />
      <div className="grow">
        <h2 style={{ margin: 0 }}>Trophies</h2>
        <div className="small muted">{done.length} of {stats.trophies.length} unlocked · {name} is a {lv.title}</div>
        <div className="trophy-mini">{stats.trophies.map((t) => <span key={t.id} className={t.value >= t.goal ? 'ok' : ''}>{t.icon}</span>)}</div>
      </div>
      <span className="muted">›</span>
      {open && <div onClick={(e) => e.stopPropagation()}><TrophySheet trophies={stats.trophies} name={name} xp={stats.xp} onClose={() => setOpen(false)} /></div>}
    </section>
  )
}

type Part = 'body' | 'targets' | 'food' | 'training'

/** One form for any set of profile sections, saved together. */
function ProfileForm({ parts, onDone }: { parts: Part[]; onDone: () => void }) {
  const { profile, saveProfile, bump } = useStore()
  const toast = useToast()
  const [p, setP] = useState<Profile>(profile!)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }))
  const num = (v: string) => (v === '' ? null : Number(v.replace(',', '.')))
  const targets = computeTargets(p)
  const trainingChanged =
    JSON.stringify(p.equipment) !== JSON.stringify(profile!.equipment) ||
    p.training_days !== profile!.training_days ||
    p.session_minutes !== profile!.session_minutes

  async function save() {
    setBusy(true)
    try {
      const patch: Partial<Profile> = { ...p }
      delete (patch as { id?: string }).id
      if (trainingChanged) {
        const plan = generateWorkoutPlan(p.equipment, p.training_days ?? 3, p.session_minutes ?? 45)
        await supabase.from('workout_plans').update({ is_active: false }).eq('is_active', true)
        await supabase.from('workout_plans').insert({ plan, is_active: true })
      }
      await saveProfile(patch)
      bump()
      toast(trainingChanged ? 'Saved. Workout plan rebuilt ✓' : 'Saved ✓')
      onDone()
    } catch (e) {
      toast((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <>
      {parts.includes('body') && (
        <section className="form-sec">
          <h3>About you</h3>
          <label className="field"><span>Name</span><input className="input" value={p.display_name ?? ''} onChange={(e) => set('display_name', e.target.value)} /></label>
          <label className="field"><span>Sex</span>
            <Seg<Sex> options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }, { id: 'other', label: 'Other' }]} value={(p.sex ?? 'other') as Sex} onChange={(v) => set('sex', v)} />
          </label>
          <div className="grid2">
            <label className="field"><span>Year of birth</span><input className="input" inputMode="numeric" value={p.birth_year ?? ''} onChange={(e) => set('birth_year', num(e.target.value))} /></label>
            <label className="field"><span>Height (cm)</span><input className="input" inputMode="decimal" value={p.height_cm ?? ''} onChange={(e) => set('height_cm', num(e.target.value))} /></label>
            <label className="field"><span>Start weight (kg)</span><input className="input" inputMode="decimal" value={p.start_weight_kg ?? ''} onChange={(e) => set('start_weight_kg', num(e.target.value))} /></label>
            <label className="field"><span>Goal weight (kg)</span><input className="input" inputMode="decimal" value={p.target_weight_kg ?? ''} onChange={(e) => set('target_weight_kg', num(e.target.value))} /></label>
          </div>
          <label className="field"><span>Everyday activity</span>
            <select className="input" value={p.activity_level ?? 'light'} onChange={(e) => set('activity_level', e.target.value as Activity)}>
              {(Object.keys(ACTIVITY) as Activity[]).map((a) => <option key={a} value={a}>{ACTIVITY[a].label}</option>)}
            </select>
          </label>
          <label className="field"><span>Pace</span>
            <Seg<number> options={[{ id: 0.25, label: '0.25 kg/wk' }, { id: 0.5, label: '0.5 kg/wk' }, { id: 0.75, label: '0.75 kg/wk' }]} value={Number(p.weekly_loss_kg ?? 0.5)} onChange={(v) => set('weekly_loss_kg', v)} />
          </label>
        </section>
      )}
      {parts.includes('targets') && (
        <section className="form-sec">
          <h3>Daily targets</h3>
          <div className="grid2">
            <label className="field"><span>Calories (kcal)</span><input className="input" inputMode="numeric" value={p.kcal_target ?? ''} onChange={(e) => set('kcal_target', num(e.target.value))} /></label>
            <label className="field"><span>Protein (g)</span><input className="input" inputMode="numeric" value={p.protein_target_g ?? ''} onChange={(e) => set('protein_target_g', num(e.target.value))} /></label>
            <label className="field"><span>Water (ml)</span><input className="input" inputMode="numeric" value={p.water_target_ml ?? ''} onChange={(e) => set('water_target_ml', num(e.target.value))} /></label>
            <label className="field"><span>Sleep (h)</span><input className="input" inputMode="decimal" value={p.sleep_target_h ?? ''} onChange={(e) => set('sleep_target_h', num(e.target.value))} /></label>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Suggested: {targets.kcal} kcal, {targets.protein} g protein (you burn ≈ {targets.tdee} kcal a day).</p>
          <button className="link" style={{ paddingLeft: 0 }} onClick={() => setP((x) => ({ ...x, kcal_target: targets.kcal, protein_target_g: targets.protein }))}>Use suggestion</button>
        </section>
      )}
      {parts.includes('food') && (
        <section className="form-sec">
          <h3>Food preferences</h3>
          <label className="field"><span>Diet</span><Chips options={DIET_TAGS} value={p.diet_tags ?? []} onChange={(v) => set('diet_tags', v)} /></label>
          <label className="field"><span>Foods you don’t eat</span><ListInput value={p.avoid_foods ?? ''} onChange={(v) => set('avoid_foods', v)} options={INGREDIENT_NAMES} placeholder="e.g. mushrooms, salmon" /></label>
          <label className="field"><span>Max cooking time</span>
            <Seg<number> options={[{ id: 15, label: '15 min' }, { id: 30, label: '30 min' }, { id: 45, label: '45+ min' }]} value={p.cook_time_min ?? 30} onChange={(v) => set('cook_time_min', v)} />
          </label>
        </section>
      )}
      {parts.includes('training') && (
        <section className="form-sec">
          <h3>Training setup</h3>
          <label className="field"><span>Equipment</span>
            <Chips options={EQUIPMENT.map((e) => ({ id: e.id, label: e.label }))} value={p.equipment ?? []} onChange={(v) => set('equipment', v)} />
          </label>
          <label className="field"><span>Workouts per week</span>
            <Seg<number> options={[2, 3, 4, 5, 6].map((n) => ({ id: n, label: String(n) }))} value={p.training_days ?? 3} onChange={(v) => set('training_days', v)} />
          </label>
          <label className="field"><span>Time per workout</span>
            <Seg<number> options={[20, 30, 45, 60].map((n) => ({ id: n, label: `${n} min` }))} value={p.session_minutes ?? 45} onChange={(v) => set('session_minutes', v)} />
          </label>
          {trainingChanged && <p className="small" style={{ color: 'var(--accent)', margin: 0 }}>Saving will rebuild your workout plan.</p>}
        </section>
      )}
      <button className="btn block" style={{ marginTop: 6 }} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
    </>
  )
}

const BACKUP_TABLES = ['profiles', 'weight_logs', 'meal_logs', 'water_logs', 'sleep_logs', 'workout_logs', 'workout_plans', 'meal_plans', 'fasts', 'body_measurements', 'recipe_favorites']

async function exportBackup(email: string | undefined) {
  const out: Record<string, unknown> = { app: 'Lighter', exported_at: new Date().toISOString(), account: email ?? null }
  for (const t of BACKUP_TABLES) {
    const rows: unknown[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(t).select('*').range(from, from + 999)
      if (error) throw new Error(`${t}: ${error.message}`)
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    out[t] = rows
  }
  const local: Record<string, string> = {}
  for (const k of ['pet-name', 'pantry', 'theme', 'show-fasting', 'pet-pets']) { try { const v = localStorage.getItem(k); if (v != null) local[k] = v } catch { /* ignore */ } }
  out.device_settings = local
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
  const name = `lighter-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([blob], name, { type: 'application/json' })
  // iPhone: share sheet lets you save to Files / iCloud; elsewhere a normal download
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Lighter backup' }); return } catch (e) { if ((e as Error).name === 'AbortError') return }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { session } = useStore()
  const toast = useToast()
  const [theme, setTheme] = useTheme()
  const [fasting, setFasting] = useState<'on' | 'off'>(fastingVisible() ? 'on' : 'off')
  const [edit, setEdit] = useState<Part[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [rem, setRem] = useState(false)
  if (rem) return <RemindersSheet onClose={() => setRem(false)} />
  if (edit) return <Sheet title={edit.includes('food') ? 'Food preferences' : 'Training setup'} onClose={() => setEdit(null)}><ProfileForm parts={edit} onDone={() => setEdit(null)} /></Sheet>
  return (
    <Sheet title="Settings" onClose={onClose}>
      <section className="form-sec">
        <h3>Appearance</h3>
        <Seg options={[{ id: 'system', label: 'Auto' }, { id: 'light', label: '☀️ Light' }, { id: 'dark', label: '🌙 Dark' }]} value={theme} onChange={setTheme} />
        <label className="field" style={{ marginTop: 14, marginBottom: 0 }}><span>Fasting timer on Today</span>
          <Seg<'on' | 'off'> options={[{ id: 'on', label: 'Show' }, { id: 'off', label: 'Hide' }]} value={fasting} onChange={(v) => { setFasting(v); try { localStorage.setItem('show-fasting', v) } catch { /* ignore */ } }} />
        </label>
      </section>
      <div className="set-list">
        <button onClick={() => setRem(true)}><span>🔔 Reminders</span><span className="muted">›</span></button>
        <button onClick={() => setEdit(['food'])}><span>🥗 Food preferences</span><span className="muted">›</span></button>
        <button onClick={() => setEdit(['training'])}><span>🏋️ Training setup</span><span className="muted">›</span></button>
      </div>
      <section className="form-sec">
        <h3>Your data</h3>
        <p className="small muted" style={{ marginTop: 0 }}>Everything you log is saved to your account ({session?.user.email}), so you get the same data when you sign in on another phone or computer. Each account only sees its own data.</p>
        <button className="btn ghost block" disabled={busy} onClick={async () => {
          setBusy(true)
          try { await exportBackup(session?.user.email); toast('Backup ready ✓') } catch (e) { toast((e as Error).message) }
          setBusy(false)
        }}>{busy ? 'Preparing backup…' : '⬇️ Download backup (all data)'}</button>
      </section>
      <button className="btn danger block" style={{ marginTop: 8 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
      <p className="small muted" style={{ textAlign: 'center' }}>Lighter · calorie targets are estimates, not medical advice.</p>
    </Sheet>
  )
}

export default function Me() {
  const { profile, session, version } = useStore()
  const [settings, setSettings] = useState(false)
  const [edit, setEdit] = useState<Part[] | null>(null)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { latestWeight().then((w) => setNow(w ? Number(w.weight_kg) : null)) }, [version])
  if (!profile) return null

  const cur = now ?? profile.start_weight_kg
  const start = profile.start_weight_kg
  const goal = profile.target_weight_kg
  const lost = start && cur ? round1(start - cur) : null
  const toGo = goal && cur ? round1(cur - goal) : null
  const pct = start && goal && cur && start !== goal ? Math.max(0, Math.min(1, (start - cur) / (start - goal))) : 0
  const curBmi = profile.height_cm && cur ? round1(bmi(cur, profile.height_cm)) : null
  const yrs = profile.birth_year ? age(profile.birth_year) : null
  const name = profile.display_name || session?.user.email?.split('@')[0] || 'You'
  const tiles: [string, string | number | null, string][] = [
    ['Now', cur != null ? round1(cur) : null, 'kg'],
    ['Goal', goal, 'kg'],
    ['Lost', lost != null ? (lost > 0 ? lost : 0) : null, 'kg'],
    ['BMI', curBmi, ''],
    ['Height', profile.height_cm, 'cm'],
    ['Age', yrs, 'y'],
  ]

  return (
    <>
      <header className="page-head me-head">
        <div className="me-id">
          <div className="me-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <h1>{name}</h1>
            <div className="sub">{ACTIVITY[profile.activity_level ?? 'light']?.label ?? ''}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Settings">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </header>

      <section className="card">
        <div className="card-head"><h2>My stats</h2><button className="link" onClick={() => setEdit(['body'])}>Edit</button></div>
        {goal && start ? (
          <div className="me-goal">
            <div className="row between small"><span>{round1(start)} kg</span><b>{toGo != null && toGo > 0 ? `${toGo} kg to go` : '🎉 Goal reached'}</b><span>{goal} kg</span></div>
            <div className="xp" style={{ marginTop: 6 }}><i style={{ width: `${Math.round(pct * 100)}%` }} /></div>
          </div>
        ) : null}
        <div className="me-tiles">
          {tiles.map(([l, v, u]) => (
            <button key={l} className="me-tile" onClick={() => setEdit(['body'])}>
              <b className="num">{v ?? '–'}{v != null && u ? <small> {u}</small> : null}</b>
              <span>{l}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>My daily targets</h2><button className="link" onClick={() => setEdit(['targets'])}>Edit</button></div>
        <div className="me-tiles four">
          {([['Calories', profile.kcal_target, 'kcal'], ['Protein', profile.protein_target_g, 'g'], ['Water', profile.water_target_ml ? round1(profile.water_target_ml / 1000) : null, 'L'], ['Sleep', profile.sleep_target_h, 'h']] as [string, number | null, string][]).map(([l, v, u]) => (
            <button key={l} className="me-tile" onClick={() => setEdit(['targets'])}>
              <b className="num">{v ?? '–'}{v != null ? <small> {u}</small> : null}</b>
              <span>{l}</span>
            </button>
          ))}
        </div>
      </section>

      <TrophyCard />

      {edit && <Sheet title={edit.includes('targets') ? 'Daily targets' : 'My details'} onClose={() => setEdit(null)}><ProfileForm parts={edit} onDone={() => setEdit(null)} /></Sheet>}
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </>
  )
}
