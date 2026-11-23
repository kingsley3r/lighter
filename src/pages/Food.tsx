import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { CheckBox, Seg, Sheet, useToast } from '../components/ui'
import AddMeal from '../components/AddMeal'
import PetCard, { type FeedEvent } from '../components/Pet'
import Recipes from '../components/Recipes'
import DayStrip from '../components/DayStrip'
import { macroTargets } from '../lib/calc'
import { addDays, fmtShort, fmtTime, isoDate, parseDate, startOfWeek, WEEKDAYS, WEEKDAYS_LONG, weekdayIdx } from '../lib/dates'
import { copyMeals, dayRange, mealPlanForWeek, mealsBetween, sum } from '../lib/data'
import { generateMealPlan } from '../data/recipes'
import GroceryList from '../components/GroceryList'
import { supabase } from '../lib/supabase'
import type { MealLog, MealPlan, MealType, PlannedMeal } from '../lib/types'

const ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' }

export default function Food() {
  const [tab, setTab] = useState<'log' | 'plan' | 'recipes'>('log')
  const [shop, setShop] = useState(false)
  return (
    <>
      <header className="page-head"><h1>Food</h1><button className="btn ghost sm" onClick={() => setShop(true)} aria-label="Shopping list">🛒 List</button></header>
      {shop && <GroceryList onClose={() => setShop(false)} />}
      <div style={{ marginBottom: 14 }}>
        <Seg options={[{ id: 'log', label: 'Diary' }, { id: 'plan', label: 'Meal plan' }, { id: 'recipes', label: 'Recipes' }]} value={tab} onChange={setTab} />
      </div>
      {tab === 'log' ? <Diary /> : tab === 'plan' ? <Plan /> : <Recipes />}
    </>
  )
}

function Diary() {
  const { profile, version, bump } = useStore()
  const [date, setDate] = useState(new Date())
  const [meals, setMeals] = useState<MealLog[]>([])
  const [prev, setPrev] = useState<MealLog[]>([])
  const [adding, setAdding] = useState(false)
  const [feed, setFeed] = useState<FeedEvent | null>(null)
  const fedIds = useRef<Set<number> | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    const r = dayRange(date)
    const p = dayRange(addDays(date, -1))
    const [a, b] = await Promise.all([mealsBetween(r.from, r.to), mealsBetween(p.from, p.to)])
    setMeals(a)
    setPrev(b)
    if (fedIds.current) {
      const before = fedIds.current
      const fresh = a.filter((m) => !before.has(m.id)).sort((x, y) => y.id - x.id)[0]
      fedIds.current = null
      if (fresh) setFeed({ id: fresh.id, name: fresh.name, kcal: fresh.kcal, protein_g: Number(fresh.protein_g), carbs_g: Number(fresh.carbs_g), fat_g: Number(fresh.fat_g) })
    }
  }, [date])

  const copy = async (t: MealType) => {
    const src = prev.filter((m) => (m.meal_type ?? 'snack') === t)
    const { error } = await copyMeals(src, date)
    if (error) return toast(error.message)
    toast(`Copied ${src.length} item${src.length > 1 ? 's' : ''} ✓`)
    load()
    bump()
  }
  useEffect(() => {
    load()
  }, [load, version])

  const total = sum(meals, (m) => m.kcal)
  const target = profile?.kcal_target ?? 2000
  const isToday = isoDate(date) === isoDate()
  const targets = useMemo(() => ({ kcal: target, ...macroTargets(target, profile?.protein_target_g ?? 120) }), [target, profile?.protein_target_g])

  return (
    <>
      <DayStrip date={date} onChange={setDate} />
      {isToday && <PetCard meals={meals} targets={targets} feed={feed} onFeed={() => setAdding(true)} />}
      <div className="card row between">
        <div>
          <div className="small muted">{isToday ? 'Today' : fmtShort(date)}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="num">{total} <span className="small muted">/ {target} kcal</span></div>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>+ Log</button>
      </div>
      {ORDER.map((t) => {
        const list = meals.filter((m) => (m.meal_type ?? 'snack') === t)
        return (
          <section key={t} className="card">
            <div className="card-head">
              <h2>{LABEL[t]}</h2>
              <span className="small muted num">{sum(list, (m) => m.kcal)} kcal</span>
            </div>
            {list.length === 0 ? (
              prev.some((m) => (m.meal_type ?? 'snack') === t) ? (
                <button className="btn ghost sm" onClick={() => copy(t)}>Same as yesterday ({sum(prev.filter((m) => (m.meal_type ?? 'snack') === t), (m) => m.kcal)} kcal)</button>
              ) : (
                <div className="small muted">—</div>
              )
            ) : (
              list.map((m) => (
                <div key={m.id} className="list-item">
                  <div className="grow">
                    <div className="title">{m.name}</div>
                    <div className="small muted">{fmtTime(m.eaten_at)} · P {Math.round(m.protein_g)} · C {Math.round(m.carbs_g)} · F {Math.round(m.fat_g)}{m.source === 'photo' ? ' · 📷' : ''}</div>
                  </div>
                  <div className="num" style={{ fontWeight: 600 }}>{m.kcal}</div>
                  <button className="btn ghost sm icon" aria-label={`Delete ${m.name}`} onClick={async () => { await supabase.from('meal_logs').delete().eq('id', m.id); load(); bump() }}>✕</button>
                </div>
              ))
            )}
          </section>
        )
      })}
      {adding && <AddMeal date={isToday ? undefined : date} onClose={() => setAdding(false)} onSaved={() => { if (isToday) fedIds.current = new Set(meals.map((m) => m.id)); load(); bump() }} />}
    </>
  )
}

function Plan() {
  const { profile, bump } = useStore()
  const toast = useToast()
  const [date, setDate] = useState(new Date())
  const [plan, setPlan] = useState<(MealPlan & { id: number }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'' | 'templates' | 'ai'>('')
  const [open, setOpen] = useState<PlannedMeal | null>(null)
  const [shop, setShop] = useState(false)
  const ws = useMemo(() => startOfWeek(date), [date])

  const load = useCallback(async () => {
    setLoading(true)
    setPlan(await mealPlanForWeek(ws))
    setLoading(false)
  }, [ws])
  useEffect(() => {
    load()
  }, [load])

  async function generate(kind: 'templates' | 'ai') {
    if (!profile) return
    setBusy(kind)
    try {
      let newPlan: MealPlan
      if (kind === 'ai') {
        const { data: s } = await supabase.auth.getSession()
        const res = await fetch('/api/meal-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
          body: JSON.stringify({ week_start: isoDate(ws) }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'AI plan failed. Try the free plan.')
        newPlan = body.plan
      } else {
        newPlan = generateMealPlan({
          kcal: profile.kcal_target ?? 2000,
          tags: profile.diet_tags ?? [],
          avoid: profile.avoid_foods ?? '',
          cookMinutes: profile.cook_time_min ?? 30,
          start: ws,
        })
      }
      await supabase.from('meal_plans').delete().eq('week_start', isoDate(ws))
      const { error } = await supabase.from('meal_plans').insert({ week_start: isoDate(ws), plan: newPlan })
      if (error) throw error
      try { localStorage.removeItem('shop-' + isoDate(ws)) } catch { /* ignore */ }
      await load()
      toast('New meal plan ready ✓')
    } catch (e) {
      toast((e as Error).message)
    }
    setBusy('')
  }

  async function logPlanned(m: PlannedMeal) {
    const { error } = await supabase.from('meal_logs').insert({
      name: m.name, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, meal_type: m.meal_type, source: 'plan',
    })
    if (error) return toast(error.message)
    toast('Logged to today ✓')
    bump()
    setOpen(null)
  }

  const day = plan?.days.find((d) => d.date === isoDate(date)) ?? plan?.days[weekdayIdx(date)]

  return (
    <>
      <DayStrip date={date} onChange={setDate} />
      {loading ? (
        <div className="empty">Loading…</div>
      ) : !plan ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>🥗</div>
          <h2 style={{ marginTop: 6 }}>No plan for this week yet</h2>
          <p className="small muted">Simple meals you can cook at home, sized to about {profile?.kcal_target ?? 2000} kcal a day{profile?.diet_tags?.length ? ` and matching your diet` : ''}.</p>
          <div className="stack">
            <button className="btn block" disabled={!!busy} onClick={() => generate('templates')}>{busy === 'templates' ? 'Creating…' : 'Create plan'}</button>
            <button className="btn outline block" disabled={!!busy} onClick={() => generate('ai')}>{busy === 'ai' ? 'AI is cooking up ideas…' : '✨ Create with AI'}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="card row between">
            <div>
              <div className="small muted">{WEEKDAYS_LONG[weekdayIdx(date)]}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }} className="num">{day ? sum(day.meals, (m) => m.kcal) : 0} kcal</div>
            </div>
            <button className="btn ghost sm" onClick={() => setShop(true)}>🛒 Shopping list</button>
          </div>
          {day?.meals.map((m, idx) => (
            <button key={idx} className="card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }} onClick={() => setOpen(m)}>
              <div style={{ fontSize: 30 }}>{m.emoji}</div>
              <div className="grow">
                <div className="small muted">{LABEL[m.meal_type]} · {m.minutes} min</div>
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div className="small muted num">{m.kcal} kcal · P {m.protein_g} g{m.servings !== 1 ? ` · ${m.servings}× portion` : ''}</div>
              </div>
              <span className="muted">›</span>
            </button>
          ))}
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn ghost grow sm" disabled={!!busy} onClick={() => generate('templates')}>{busy === 'templates' ? 'Creating…' : '↻ New plan'}</button>
            <button className="btn ghost grow sm" disabled={!!busy} onClick={() => generate('ai')}>{busy === 'ai' ? 'Thinking…' : '✨ New AI plan'}</button>
          </div>
          {plan.source === 'ai' && <p className="small muted" style={{ textAlign: 'center' }}>Created by AI. Calories are estimates.</p>}
        </>
      )}

      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <div className="row wrap" style={{ marginBottom: 12 }}>
            <span className="pill accent">{open.kcal} kcal</span>
            <span className="pill">P {open.protein_g} g</span>
            <span className="pill">C {open.carbs_g} g</span>
            <span className="pill">F {open.fat_g} g</span>
            <span className="pill">{open.minutes} min</span>
          </div>
          <h3>Ingredients{open.servings !== 1 ? ` (${open.servings}× portion)` : ''}</h3>
          <ul style={{ paddingLeft: 18, marginTop: 4 }}>
            {open.ingredients.map((x, k) => <li key={k}><span className="num">{fmtQty(x.qty)} {x.unit}</span> {x.item}</li>)}
          </ul>
          <h3>Steps</h3>
          <ol style={{ paddingLeft: 18, marginTop: 4 }}>
            {open.steps.map((s, k) => <li key={k} style={{ marginBottom: 4 }}>{s}</li>)}
          </ol>
          <button className="btn block" onClick={() => logPlanned(open)}>I ate this today</button>
        </Sheet>
      )}
      {shop && <GroceryList plan={plan} onClose={() => setShop(false)} />}
    </>
  )
}

function fmtQty(q: number) {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')
}

