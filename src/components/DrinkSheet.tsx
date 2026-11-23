import { useState } from 'react'
import { Sheet, useToast } from './ui'
import Autocomplete from './Autocomplete'
import { COMMON_FOODS, suggestFoods, type CommonFood } from '../data/common-foods'
import { supabase } from '../lib/supabase'
import { guessMealType } from '../lib/data'

const QUICK = ['Coffee, black', 'Cappuccino', 'Tea, unsweetened', 'Cola zero / diet soda', 'Orange juice', 'Beer']
const ALCOHOL = /beer|wine|spritz|aperol/i

/** Log any drink: counts toward water (except alcohol) and, if it has calories, toward food. */
export default function DrinkSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<CommonFood | null>(null)
  const [ml, setMl] = useState(250)
  const [busy, setBusy] = useState(false)

  const choose = (f: CommonFood, amount?: number) => {
    setPick(f)
    setQ(f.name)
    setMl(amount ?? f.ml ?? 250)
  }
  const k = pick ? ml / (pick.ml ?? 250) : 1

  async function save() {
    if (!pick) return
    setBusy(true)
    const jobs = []
    if (!ALCOHOL.test(pick.name)) jobs.push(supabase.from('water_logs').insert({ amount_ml: ml }))
    if (pick.kcal * k >= 5)
      jobs.push(
        supabase.from('meal_logs').insert({
          name: pick.name,
          kcal: Math.round(pick.kcal * k),
          protein_g: Math.round(pick.p * k * 10) / 10,
          carbs_g: Math.round(pick.c * k * 10) / 10,
          fat_g: Math.round(pick.f * k * 10) / 10,
          source: 'manual',
          notes: `${ml} ml`,
          meal_type: guessMealType(),
        }),
      )
    const res = await Promise.all(jobs)
    setBusy(false)
    const err = res.find((r) => r.error)?.error
    if (err) return toast(err.message)
    toast(`${pick.name} logged ✓`)
    onSaved()
    onClose()
  }

  return (
    <Sheet title="Log a drink" onClose={onClose}>
      <Autocomplete
        autoFocus
        placeholder="Coffee, juice, cola…"
        value={q}
        onChange={(v) => {
          setQ(v)
          if (pick && v !== pick.name) setPick(null)
        }}
        suggest={(t) =>
          pick && t === pick.name
            ? []
            : suggestFoods(t, { drinksOnly: true, limit: 7 }).map((f) => ({
                key: f.name,
                label: f.name,
                sub: f.portion,
                right: `${f.kcal} kcal`,
                onPick: () => choose(f, Math.round((f.ml ?? 250) * f.qty)),
              }))
        }
      />
      {!pick && (
        <div className="chips" style={{ marginTop: 12 }}>
          {QUICK.map((n) => {
            const f = COMMON_FOODS.find((x) => x.name === n)!
            return <button key={n} className="chip" onClick={() => choose(f)}>{n}</button>
          })}
        </div>
      )}
      {pick && (
        <>
          <label className="field" style={{ marginTop: 14 }}><span>Amount (ml)</span>
            <div className="row">
              {[150, 250, 330, 500].map((v) => <button key={v} className={'chip' + (ml === v ? ' on' : '')} onClick={() => setMl(v)}>{v}</button>)}
              <input className="input grow" inputMode="numeric" value={ml} onChange={(e) => setMl(Number(e.target.value) || 0)} style={{ minWidth: 70 }} />
            </div>
          </label>
          <p className="small muted">
            {Math.round(pick.kcal * k)} kcal
            {ALCOHOL.test(pick.name) ? ' · alcohol doesn’t count toward water' : ` · counts as ${ml} ml water`}
          </p>
          <button className="btn block" disabled={busy || ml <= 0} onClick={save}>{busy ? 'Saving…' : 'Log drink'}</button>
        </>
      )}
    </Sheet>
  )
}
