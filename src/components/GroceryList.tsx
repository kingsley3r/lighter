import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addItems, AISLE_ICON, AISLES, fmtAmount, listItems, type ShopItem } from '../lib/grocery'
import type { MealPlan } from '../lib/types'
import { mealPlanForWeek } from '../lib/data'
import { startOfWeek } from '../lib/dates'
import { Sheet, useToast } from './ui'

function readPantry(): string[] { try { return JSON.parse(localStorage.getItem('pantry') || '[]') } catch { return [] } }

/** Adds every ingredient of a meal plan, skipping what's already in your kitchen list. */
export async function addPlan(plan: MealPlan) {
  const pantry = readPantry().map((p) => p.toLowerCase())
  const items = plan.days.flatMap((d) => d.meals.flatMap((m) => m.ingredients.map((i) => ({ name: i.item, qty: i.qty, unit: i.unit, recipe: m.name }))))
  return addItems(items.filter((i) => !pantry.some((p) => i.name.toLowerCase().includes(p))))
}

export default function GroceryList({ plan: given, onClose }: { plan?: MealPlan | null; onClose: () => void }) {
  const toast = useToast()
  const [plan, setPlan] = useState<MealPlan | null>(given ?? null)
  useEffect(() => { if (given === undefined) mealPlanForWeek(startOfWeek(new Date())).then(setPlan) }, [given])
  const [items, setItems] = useState<ShopItem[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => listItems().then(setItems), [])
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const open = (items ?? []).filter((x) => !x.done)
    return AISLES.map((a) => ({ aisle: a, list: open.filter((x) => x.aisle === a).sort((p, q) => p.name.localeCompare(q.name)) })).filter((g) => g.list.length)
  }, [items])
  const done = (items ?? []).filter((x) => x.done)

  async function toggle(x: ShopItem) {
    setItems((cur) => cur?.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)) ?? null)
    await supabase.from('shopping_items').update({ done: !x.done }).eq('id', x.id)
  }
  async function add() {
    const t = text.trim()
    if (!t) return
    setText('')
    const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|x|pcs)?\s+(.+)$/i)
    await addItems([m ? { name: m[3], qty: Number(m[1].replace(',', '.')), unit: (m[2] ?? '').toLowerCase().replace(/^x|pcs$/, '') } : { name: t }])
    load()
  }
  async function clearDone() {
    await supabase.from('shopping_items').delete().eq('done', true)
    load()
  }
  async function clearAll() {
    if (!confirm('Remove everything from the list?')) return
    await supabase.from('shopping_items').delete().gte('id', 0)
    load()
  }
  async function fromPlan() {
    if (!plan) return
    setBusy(true)
    try { const n = await addPlan(plan); toast(n ? `Added ${n} items from your meal plan` : 'Everything is already on the list') } catch (e) { toast((e as Error).message) }
    setBusy(false)
    load()
  }
  async function share() {
    const txt = groups.map((g) => `${AISLE_ICON[g.aisle]} ${g.aisle}\n` + g.list.map((x) => `• ${x.name}${fmtAmount(x) ? ` (${fmtAmount(x)})` : ''}`).join('\n')).join('\n\n')
    try {
      if (navigator.share) await navigator.share({ title: 'Shopping list', text: txt })
      else { await navigator.clipboard.writeText(txt); toast('List copied') }
    } catch { /* cancelled */ }
  }

  return (
    <Sheet title="Shopping list" onClose={onClose}>
      <form className="row" style={{ gap: 8, marginBottom: 10 }} onSubmit={(e) => { e.preventDefault(); add() }}>
        <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add item, e.g. 500 g chicken" enterKeyHint="done" />
        <button className="btn sm" disabled={!text.trim()}>Add</button>
      </form>
      {plan && <button className="btn ghost block sm" style={{ marginBottom: 12 }} disabled={busy} onClick={fromPlan}>{busy ? 'Adding…' : '🥗 Add this week’s meal plan'}</button>}

      {items === null ? <div className="empty">Loading…</div> : groups.length === 0 && done.length === 0 ? (
        <div className="empty">Your list is empty. Add this week’s plan, or tap “Add to shopping list” on any recipe.</div>
      ) : (
        <>
          {groups.length === 0 && <div className="empty">All done. Nice shopping! 🎉</div>}
          {groups.map((g) => (
            <section key={g.aisle} className="shop-group">
              <h3>{AISLE_ICON[g.aisle]} {g.aisle}<span className="muted small"> · {g.list.length}</span></h3>
              {g.list.map((x) => <Row key={x.id} x={x} onToggle={() => toggle(x)} />)}
            </section>
          ))}
          {done.length > 0 && (
            <section className="shop-group done">
              <h3 className="row between"><span>✓ In the basket · {done.length}</span><button className="link" onClick={clearDone}>Clear</button></h3>
              {done.map((x) => <Row key={x.id} x={x} onToggle={() => toggle(x)} />)}
            </section>
          )}
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            {groups.length > 0 && <button className="btn ghost grow sm" onClick={share}>Share list</button>}
            <button className="btn ghost grow sm" onClick={clearAll}>Empty list</button>
          </div>
        </>
      )}
    </Sheet>
  )
}

function Row({ x, onToggle }: { x: ShopItem; onToggle: () => void }) {
  const amt = fmtAmount(x)
  return (
    <button className={`shop-row${x.done ? ' on' : ''}`} onClick={onToggle} aria-pressed={x.done}>
      <span className="shop-box">{x.done ? '✓' : ''}</span>
      <span className="grow">
        <span className="shop-name">{x.name}</span>
        {x.recipes.length > 0 && <span className="small muted shop-for">for {x.recipes.slice(0, 2).join(', ')}{x.recipes.length > 2 ? ` +${x.recipes.length - 2}` : ''}</span>}
      </span>
      {amt && <span className="small muted num">{amt}</span>}
    </button>
  )
}
