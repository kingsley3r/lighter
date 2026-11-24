import { useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { RECIPES, recipeAllowed, type Recipe } from '../data/recipes'
import type { MealType } from '../lib/types'
import { useToast } from './ui'

function nextMeal(h: number, logged: Set<string>): MealType {
  if (h < 10 && !logged.has('breakfast')) return 'breakfast'
  if (h < 15 && !logged.has('lunch')) return 'lunch'
  if (h < 21 && !logged.has('dinner')) return 'dinner'
  return 'snack'
}

/** Picks recipes that fit the calories and protein you have left, so the day ends close to target. */
export function suggest(opts: { kcalLeft: number; proteinLeft: number; meal: MealType; tags: string[]; avoid: string; exclude?: Set<string> }): Recipe[] {
  const kind = opts.meal === 'breakfast' ? 'breakfast' : opts.meal === 'snack' ? 'snack' : 'main'
  // leave room for a snack later unless this is the last meal of the day
  const budget = opts.meal === 'dinner' || opts.meal === 'snack' ? opts.kcalLeft : opts.kcalLeft * 0.6
  const pool = RECIPES.filter((r) => r.kind === kind && recipeAllowed(r, opts.tags, opts.avoid, 0) && !opts.exclude?.has(r.id))
  const scored = pool.map((r) => {
    const over = Math.max(0, r.kcal - budget)
    const fill = Math.min(r.kcal, budget) / Math.max(1, budget) // closer to the budget is better
    const pScore = opts.proteinLeft > 0 ? Math.min(1, r.p / Math.max(20, opts.proteinLeft * (kind === 'snack' ? 0.3 : 0.5))) : 0.5
    return { r, s: pScore * 2 + fill - over / 150 }
  })
  return scored.sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.r)
}

export function MealIdeasCard({ kcalLeft, proteinLeft, loggedTypes, onLogged }: { kcalLeft: number; proteinLeft: number; loggedTypes: Set<string>; onLogged: () => void }) {
  const { profile, bump } = useStore()
  const toast = useToast()
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Recipe | null>(null)
  if (!profile) return null
  const meal = nextMeal(new Date().getHours(), loggedTypes)
  if (kcalLeft < 120) return null
  const args = { kcalLeft, proteinLeft, meal, tags: profile.diet_tags ?? [], avoid: profile.avoid_foods ?? '' }
  let list = suggest({ ...args, exclude: skip })
  if (list.length < 3 && skip.size) list = suggest(args) // ran out: start over
  if (!list.length) return null

  async function log(r: Recipe) {
    const { error } = await supabase.from('meal_logs').insert({ name: r.name, kcal: r.kcal, protein_g: r.p, carbs_g: r.c, fat_g: r.f, meal_type: meal, source: 'plan' })
    if (error) return toast(error.message)
    toast(`${r.emoji} Logged. Pip approves!`)
    setOpen(null); bump(); onLogged()
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Pip suggests for {meal}</h2>
        <button className="link small" onClick={() => { setOpen(null); setSkip(list.length < 3 ? new Set() : new Set([...skip, ...list.map((r) => r.id)])) }}>Shuffle</button>
      </div>
      <p className="small muted" style={{ marginTop: -4 }}>You have <b>{Math.round(kcalLeft)} kcal</b>{proteinLeft > 5 ? <> and <b>{Math.round(proteinLeft)} g protein</b></> : null} left today.</p>
      <div className="ideas">
        {list.map((r) => (
          <button key={r.id} className={`idea${open?.id === r.id ? ' on' : ''}`} onClick={() => setOpen(open?.id === r.id ? null : r)}>
            <span className="idea-emoji">{r.emoji}</span>
            <span className="idea-name">{r.name}</span>
            <span className="small muted num">{r.kcal} kcal · {r.p} g P</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="idea-detail">
          <div className="small muted">{open.minutes} min · {open.ing.map((i) => i.item).slice(0, 5).join(', ')}{open.ing.length > 5 ? '…' : ''}</div>
          <ol className="small">{open.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <button className="btn block sm" onClick={() => log(open)}>✓ I ate this</button>
        </div>
      )}
    </section>
  )
}
