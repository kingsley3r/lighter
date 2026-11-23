import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { addDays, fmtShort, isoDate, startOfDay } from '../lib/dates'
import { addItems } from '../lib/grocery'
import { RECIPES, type Recipe } from '../data/recipes'
import type { MealType } from '../lib/types'
import { Seg, Sheet, useToast } from './ui'

const HOUR: Record<MealType, number> = { breakfast: 8, lunch: 13, dinner: 19, snack: 16 }
const TAG = 'prep:'

interface Batch { id: string; name: string; meal: MealType; total: number; left: { id: number; eaten_at: string }[]; kcal: number }

/** Cook once, split into portions, and log one portion per day automatically. */
export default function MealPrep({ onClose }: { onClose: () => void }) {
  const { bump, version } = useStore()
  const toast = useToast()
  const [mode, setMode] = useState<'recipe' | 'own'>('recipe')
  const [q, setQ] = useState('')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [name, setName] = useState('')
  const [tot, setTot] = useState({ kcal: '', p: '', c: '', f: '' })
  const [n, setN] = useState(4)
  const [meal, setMeal] = useState<MealType>('lunch')
  const [start, setStart] = useState<0 | 1>(1)
  const [skipWe, setSkipWe] = useState(false)
  const [shop, setShop] = useState(true)
  const [batches, setBatches] = useState<Batch[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('meal_logs').select('id,name,meal_type,kcal,eaten_at,notes').eq('source', 'prep').gte('eaten_at', startOfDay(new Date()).toISOString()).order('eaten_at').then(({ data }) => {
      const m = new Map<string, Batch>()
      for (const r of data ?? []) {
        const tag = String(r.notes ?? '').match(/prep:(\w+) · portion \d+ of (\d+)/)
        if (!tag) continue
        const b: Batch = m.get(tag[1]) ?? { id: tag[1], name: r.name, meal: r.meal_type, total: Number(tag[2]), left: [], kcal: r.kcal }
        b.left.push({ id: r.id, eaten_at: r.eaten_at })
        m.set(tag[1], b)
      }
      setBatches([...m.values()])
    })
  }, [version])

  const portion = useMemo(() => {
    if (mode === 'recipe') return recipe ? { name: recipe.name, kcal: recipe.kcal, p: recipe.p, c: recipe.c, f: recipe.f } : null
    const k = Number(tot.kcal)
    if (!name.trim() || !k) return null
    const per = (v: string) => Math.round((Number(v.replace(',', '.')) || 0) / n)
    return { name: name.trim(), kcal: Math.round(k / n), p: per(tot.p), c: per(tot.c), f: per(tot.f) }
  }, [mode, recipe, name, tot, n])

  const days = useMemo(() => {
    const out: Date[] = []
    let d = addDays(new Date(), start)
    while (out.length < n) { if (!skipWe || ![0, 6].includes(d.getDay())) out.push(d); d = addDays(d, 1) }
    return out
  }, [n, start, skipWe])

  const matches = q.trim().length < 2 ? RECIPES.filter((r) => r.kind === 'main').slice(0, 6) : RECIPES.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)

  async function save() {
    if (!portion) return
    setBusy(true)
    const id = Math.random().toString(36).slice(2, 8)
    const rows = days.map((d, i) => ({
      eaten_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), HOUR[meal]).toISOString(),
      meal_type: meal, name: portion.name, kcal: portion.kcal, protein_g: portion.p, carbs_g: portion.c, fat_g: portion.f,
      source: 'prep', notes: `${TAG}${id} · portion ${i + 1} of ${n}`,
    }))
    const { error } = await supabase.from('meal_logs').insert(rows)
    if (error) { setBusy(false); return toast(error.message) }
    if (shop && mode === 'recipe' && recipe) {
      try { await addItems(recipe.ing.map((x) => ({ name: x.item, qty: x.qty * n, unit: x.unit, recipe: `${recipe.name} ×${n}` }))) } catch { /* list is optional */ }
    }
    setBusy(false)
    toast(`${n} portions planned 🥡`)
    bump()
    onClose()
  }

  async function cancelRest(b: Batch) {
    const ids = b.left.filter((x) => new Date(x.eaten_at) > new Date()).map((x) => x.id)
    if (!ids.length || !confirm(`Remove the ${ids.length} upcoming portion${ids.length === 1 ? '' : 's'} of ${b.name}?`)) return
    const { error } = await supabase.from('meal_logs').delete().in('id', ids)
    if (error) return toast(error.message)
    toast('Removed')
    bump()
  }

  return (
    <Sheet title="Meal prep" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>Cook once, split it into portions, and Lighter logs one portion per day for you. Ate something else? Delete that day’s portion in the diary.</p>

      {batches.length > 0 && (
        <div className="card" style={{ padding: '8px 14px', marginBottom: 14 }}>
          <div className="small muted" style={{ margin: '4px 0' }}>In your fridge</div>
          {batches.map((b) => (
            <div key={b.id} className="row between prep-batch">
              <div><b>{b.name}</b><div className="small muted">{b.left.length} of {b.total} left · {b.meal} · until {fmtShort(new Date(b.left[b.left.length - 1].eaten_at))}</div></div>
              <button className="link small" onClick={() => cancelRest(b)}>Stop</button>
            </div>
          ))}
        </div>
      )}

      <Seg options={[{ id: 'recipe', label: 'From a recipe' }, { id: 'own', label: 'My own dish' }]} value={mode} onChange={setMode} />

      {mode === 'recipe' ? (
        recipe ? (
          <div className="card prep-pick" style={{ marginTop: 12 }}>
            <span style={{ fontSize: 28 }}>{recipe.emoji}</span>
            <div className="grow"><b>{recipe.name}</b><div className="small muted">{recipe.kcal} kcal · {recipe.p} g protein per portion</div></div>
            <button className="link small" onClick={() => setRecipe(null)}>Change</button>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <input className="input" placeholder="Search recipes, e.g. chili" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="prep-list">
              {matches.map((r) => (
                <button key={r.id} className="prep-row" onClick={() => setRecipe(r)}>
                  <span>{r.emoji}</span><span className="grow">{r.name}</span><span className="small muted num">{r.kcal} kcal</span>
                </button>
              ))}
              {!matches.length && <p className="small muted">No recipe found. Try “My own dish”.</p>}
            </div>
          </div>
        )
      ) : (
        <div style={{ marginTop: 12 }}>
          <label className="field"><span>Dish</span><input className="input" placeholder="e.g. Chicken curry" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="small muted" style={{ marginBottom: 6 }}>Whole batch (add up the ingredients, or scan the packs)</div>
          <div className="prep-macros">
            {([['kcal', 'kcal'], ['p', 'Protein g'], ['c', 'Carbs g'], ['f', 'Fat g']] as const).map(([k, l]) => (
              <label key={k} className="field"><span>{l}</span><input className="input" inputMode="decimal" value={tot[k]} onChange={(e) => setTot({ ...tot, [k]: e.target.value })} /></label>
            ))}
          </div>
        </div>
      )}

      <label className="field" style={{ marginTop: 12 }}><span>Portions</span>
        <div className="row prep-stepper">
          <button className="btn ghost sm" onClick={() => setN(Math.max(2, n - 1))} aria-label="Fewer portions">−</button>
          <b className="num">{n}</b>
          <button className="btn ghost sm" onClick={() => setN(Math.min(10, n + 1))} aria-label="More portions">+</button>
          {portion && <span className="small muted grow" style={{ textAlign: 'right' }}>{portion.kcal} kcal · {portion.p} g protein each</span>}
        </div>
      </label>
      <label className="field"><span>Eat it as</span>
        <Seg<MealType> options={[{ id: 'breakfast', label: 'Breakfast' }, { id: 'lunch', label: 'Lunch' }, { id: 'dinner', label: 'Dinner' }]} value={meal} onChange={setMeal} />
      </label>
      <label className="field"><span>First portion</span>
        <Seg<0 | 1> options={[{ id: 0, label: 'Today' }, { id: 1, label: 'Tomorrow' }]} value={start} onChange={setStart} />
      </label>
      <label className="row small" style={{ gap: 8, margin: '4px 0' }}><input type="checkbox" checked={skipWe} onChange={(e) => setSkipWe(e.target.checked)} /> Skip weekends</label>
      {mode === 'recipe' && recipe && <label className="row small" style={{ gap: 8, margin: '4px 0' }}><input type="checkbox" checked={shop} onChange={(e) => setShop(e.target.checked)} /> Add ingredients ×{n} to my shopping list</label>}

      <div className="prep-days">
        {days.map((d) => <span key={isoDate(d)} className="chip on">{d.toLocaleDateString('en-GB', { weekday: 'short' })} {d.getDate()}</span>)}
      </div>
      <button className="btn block" disabled={!portion || busy} onClick={save}>{busy ? 'Saving…' : `Plan ${n} portions`}</button>
    </Sheet>
  )
}
