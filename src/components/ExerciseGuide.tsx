import { useState } from 'react'
import { Sheet, ShowMore, useMore } from './ui'
import ExerciseFigure from './ExerciseFigure'
import MuscleMap from './MuscleMap'
import { EXERCISES, EQUIPMENT } from '../data/exercises'
import { guideFor, MUSCLE_LABEL, type Muscle } from '../data/guide'
import { matchScore } from '../data/common-foods'

export function ExerciseGuide({ id, onClose }: { id: string; onClose: () => void }) {
  const ex = EXERCISES.find((e) => e.id === id)
  const g = guideFor(id)
  if (!ex || !g) return null
  const gear = ex.needs.map((n) => EQUIPMENT.find((e) => e.id === n)?.label).filter(Boolean)
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <div className="guide-hero">
        <ExerciseFigure anim={g.anim} gear={ex.needs} size={260} />
      </div>
      <div className="row wrap" style={{ gap: 6, margin: '10px 0 14px' }}>
        <span className="pill accent">{ex.sets > 1 ? `${ex.sets} × ${ex.reps}` : ex.reps}</span>
        <span className="pill">{gear.length ? gear.join(' + ') : 'No equipment'}</span>
      </div>
      <section className="card">
        <h2>How to do it</h2>
        <ol className="guide-steps">
          {g.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        <p className="small" style={{ margin: '10px 0 0' }}><b>Breathing:</b> {g.breathe}</p>
      </section>
      <section className="card">
        <h2>Muscles worked</h2>
        <MuscleMap primary={g.primary} secondary={g.secondary} />
      </section>
      <section className="card">
        <h2>Avoid</h2>
        <ul className="guide-avoid">
          {g.mistakes.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
        <p className="small muted" style={{ marginBottom: 0 }}>Coach tip: {ex.cue}</p>
      </section>
    </Sheet>
  )
}

const GROUPS: { id: string; label: string; muscles: Muscle[] }[] = [
  { id: 'all', label: 'All', muscles: [] },
  { id: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors'] },
  { id: 'chest', label: 'Chest', muscles: ['chest'] },
  { id: 'back', label: 'Back', muscles: ['lats', 'upper_back', 'lower_back', 'traps'] },
  { id: 'shoulders', label: 'Shoulders', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { id: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'core', label: 'Core', muscles: ['abs', 'obliques'] },
]

export function ExerciseLibrary({ onClose, equipment }: { onClose: () => void; equipment: string[] }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('all')
  const [mine, setMine] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const muscles = GROUPS.find((x) => x.id === group)!.muscles
  const list = EXERCISES.filter((e) => {
    const g = guideFor(e.id)
    if (!g) return false
    if (mine && !e.needs.every((n) => equipment.includes(n))) return false
    if (muscles.length && !g.primary.some((m) => muscles.includes(m))) return false
    if (q.trim().length > 1 && matchScore(e.name + ' ' + g.primary.map((m) => MUSCLE_LABEL[m]).join(' '), q) <= 0) return false
    return true
  })
  const more = useMore(list, 10, `${q}|${group}|${mine}`)
  return (
    <Sheet title="Exercise library" onClose={onClose}>
      <input className="input" placeholder="Search exercise or muscle…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ margin: '10px 0' }}>
        {GROUPS.map((x) => <button key={x.id} className={'chip' + (group === x.id ? ' on' : '')} onClick={() => setGroup(x.id)}>{x.label}</button>)}
      </div>
      <label className="row small muted" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only what I can do with my equipment
      </label>
      <div className="lib-grid">
        {more.shown.map((e) => {
          const g = guideFor(e.id)!
          return (
            <button key={e.id} className="lib-card" onClick={() => setOpen(e.id)}>
              <ExerciseFigure anim={g.anim} gear={e.needs} size={120} />
              <div className="lib-name">{e.name}</div>
              <div className="small muted">{g.primary.slice(0, 2).map((m) => MUSCLE_LABEL[m]).join(' · ')}</div>
            </button>
          )
        })}
      </div>
      <ShowMore left={more.left} onClick={more.more} />
      {!list.length && <div className="empty">No exercise matches.</div>}
      {open && <ExerciseGuide id={open} onClose={() => setOpen(null)} />}
    </Sheet>
  )
}
