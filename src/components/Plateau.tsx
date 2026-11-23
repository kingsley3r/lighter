import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { addDays, isoDate } from '../lib/dates'
import { checkPlateau, type Fix, type Plateau } from '../lib/plateau'
import { useToast } from './ui'

const SNOOZE = 'plateau-snooze'

/** Shows only when the weight trend has been flat for 2 weeks. `dismissible` hides it for 7 days (used on Today). */
export default function PlateauCard({ dismissible = false, onTrain }: { dismissible?: boolean; onTrain?: () => void }) {
  const { profile, version, saveProfile } = useStore()
  const toast = useToast()
  const [p, setP] = useState<Plateau | null>(null)
  const [open, setOpen] = useState(!dismissible)
  const [hidden, setHidden] = useState(() => { try { return dismissible && (localStorage.getItem(SNOOZE) ?? '') > isoDate() } catch { return false } })
  useEffect(() => { if (profile && !hidden) checkPlateau(profile).then(setP) }, [profile, version, hidden])
  if (!p?.stalled || hidden) return null

  async function act(f: Fix) {
    const a = f.action
    if (!a) return
    if (a.kind === 'steps' && a.value) { await saveProfile({ step_target: a.value }); toast(`Step goal set to ${a.value.toLocaleString('en-US')} 👣`) }
    if (a.kind === 'kcal' && a.value) { await saveProfile({ kcal_target: a.value }); toast(`Calorie target set to ${a.value} kcal`) }
    if (a.kind === 'train') onTrain?.()
    if (a.kind === 'refeed') {
      try { localStorage.setItem('refeed-day', JSON.stringify({ day: isoDate(addDays(new Date(), 1)), kcal: a.value })) } catch { /* ignore */ }
      toast(`Tomorrow is a refeed day: aim for ~${a.value} kcal 🍝`)
    }
  }
  const snooze = () => { try { localStorage.setItem(SNOOZE, isoDate(addDays(new Date(), 7))) } catch { /* ignore */ } setHidden(true) }

  return (
    <section className="card plateau">
      <div className="card-head">
        <h2>📉 Plateau check</h2>
        {dismissible && <button className="link small" onClick={snooze}>Hide</button>}
      </div>
      <p className="small" style={{ marginTop: 0 }}>Your weight trend moved <b>{p.change14 > 0 ? '+' : ''}{p.change14} kg</b> in the last 2 weeks. Plateaus are normal. Here’s what your data suggests:</p>
      {!open ? <button className="btn ghost block sm" onClick={() => setOpen(true)}>Show {p.fixes.length} ideas</button> : (
        <div className="plateau-fixes">
          {p.fixes.map((f) => (
            <div key={f.id} className="plateau-fix">
              <span className="pf-icon">{f.icon}</span>
              <div className="grow">
                <b>{f.title}</b>
                <div className="small muted">{f.why}</div>
                {f.action && <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => act(f)}>{f.action.label}</button>}
              </div>
            </div>
          ))}
          {!p.fixes.length && <p className="small muted">Your habits look solid. Give it another week, water retention often hides fat loss for a while.</p>}
        </div>
      )}
    </section>
  )
}

/** Banner for a planned refeed day (from the plateau check). */
export function RefeedBanner() {
  let r: { day: string; kcal: number } | null = null
  try { r = JSON.parse(localStorage.getItem('refeed-day') || 'null') } catch { /* ignore */ }
  if (!r || r.day !== isoDate()) return null
  return <div className="refeed">🍝 <b>Refeed day</b>: aim for about {r.kcal} kcal today, mostly from carbs like rice, potatoes and fruit. Back to normal tomorrow.</div>
}
