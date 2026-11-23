import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { RECIPES, INGREDIENT_NAMES, type Recipe } from '../data/recipes'
import { matchScore } from '../data/common-foods'
import { askAI } from './AddMeal'
import Autocomplete from './Autocomplete'
import { Sheet, ShowMore, useMore, useToast } from './ui'
import { supabase } from '../lib/supabase'
import { addItems, type NewItem } from '../lib/grocery'
import { useStore } from '../store'
import type { MealType } from '../lib/types'

// Recipes tab: "what can I cook with what I have" + browse with photos.

interface DbRecipe { id: string; name: string; thumb: string; category?: string | null; area?: string | null; ingredients?: { item: string; measure: string }[]; steps?: string[]; youtube?: string | null; source?: string | null }
type Open = { kind: 'own'; r: Recipe } | { kind: 'db'; r: DbRecipe }

const STAPLES = /^(olive oil|oil|salt|pepper|black pepper|water|sugar|flour|butter|vegetable oil|sunflower oil|paprika|cumin|turmeric|cinnamon|chili spice|chilli powder|honey|vinegar|soy sauce|garlic)$/i
const CATS = ['Chicken', 'Beef', 'Seafood', 'Vegetarian', 'Vegan', 'Pasta', 'Breakfast', 'Dessert']
const EXTRA = ['Chicken', 'Beef', 'Pork', 'Salmon', 'Tuna', 'Shrimp', 'Mince', 'Bacon', 'Ham', 'Sausage', 'Mushrooms', 'Carrots', 'Onion', 'Garlic', 'Lemon', 'Lime', 'Ginger', 'Coconut milk', 'Cream', 'Cheese', 'Mozzarella', 'Parmesan', 'Milk', 'Butter', 'Flour', 'Pasta', 'Noodles', 'Bread', 'Rice', 'Potatoes', 'Sweet potato', 'Broccoli', 'Cauliflower', 'Peas', 'Corn', 'Beans', 'Lentils', 'Chickpeas', 'Tofu', 'Spinach', 'Kale', 'Cabbage', 'Avocado', 'Tomatoes', 'Peppers', 'Zucchini', 'Eggplant', 'Apple', 'Banana', 'Oats', 'Yogurt', 'Eggs']
const OPTIONS = [...new Set([...EXTRA, ...INGREDIENT_NAMES.map((n) => n.replace(/\s*\(.*\)/, ''))])]

const stem = (w: string) => w.replace(/ies$/, 'y').replace(/oes$/, 'o').replace(/(ch|sh|x)es$/, '$1').replace(/s$/, '')
const words = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1).map(stem)
function has(pantry: string[], item: string) {
  if (STAPLES.test(item.toLowerCase().replace(/\(.*?\)/g, '').trim())) return true
  const iw = words(item)
  return pantry.some((p) => {
    const pw = words(p)
    if (!pw.length || !iw.length) return false
    return pw.every((w) => iw.includes(w)) || iw.every((w) => pw.includes(w))
  })
}

const HUES: Record<string, [string, string]> = {
  breakfast: ['#ffe8c2', '#ffd1a1'],
  main: ['#d9f0dc', '#b4e0be'],
  snack: ['#e6e0ff', '#cfc4ff'],
}

function usePantry(): [string[], (v: string[]) => void] {
  const [p, setP] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('pantry') || '[]') } catch { return [] } })
  const set = (v: string[]) => { setP(v); try { localStorage.setItem('pantry', JSON.stringify(v)) } catch { /* ignore */ } }
  return [p, set]
}

async function api(qs: string) {
  const r = await fetch('/api/recipes?' + qs)
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error || 'Recipes unavailable right now.')
  return b
}

// TheMealDB thumbs: /medium is 500px, the original ~700px. Pick by screen density so photos stay sharp.
function Photo({ thumb, className, alt = '' }: { thumb: string; className: string; alt?: string }) {
  return (
    <img
      className={className}
      src={thumb + '/medium'}
      srcSet={`${thumb}/medium 500w, ${thumb} 700w`}
      sizes="(max-width: 560px) 50vw, 280px"
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const el = e.currentTarget
        if (el.dataset.fb) { el.style.visibility = 'hidden'; return }
        el.dataset.fb = '1'
        el.removeAttribute('srcset')
        el.src = thumb
      }}
    />
  )
}

type FavData = { kind: 'own'; id: string } | { kind: 'db'; id: string; name: string; thumb: string; category?: string | null; area?: string | null }
const favKey = (o: Open) => `${o.kind}:${o.r.id}`
const favData = (o: Open): FavData => (o.kind === 'own' ? { kind: 'own', id: o.r.id } : { kind: 'db', id: o.r.id, name: o.r.name, thumb: o.r.thumb, category: o.r.category ?? null, area: o.r.area ?? null })
const fromFav = (d: FavData): Open | null => {
  if (d.kind === 'own') { const r = RECIPES.find((x) => x.id === d.id); return r ? { kind: 'own', r } : null }
  return { kind: 'db', r: { id: d.id, name: d.name, thumb: d.thumb, category: d.category, area: d.area } }
}

export interface Favs { list: Open[]; isFav: (o: Open) => boolean; toggle: (o: Open) => void }
function useFavs(): Favs {
  const toast = useToast()
  const [rows, setRows] = useState<{ key: string; recipe: FavData }[]>([])
  useEffect(() => {
    supabase.from('recipe_favorites').select('key,recipe').order('created_at', { ascending: false }).then(({ data }) => setRows((data ?? []) as typeof rows))
  }, [])
  const isFav = useCallback((o: Open) => rows.some((x) => x.key === favKey(o)), [rows])
  const toggle = useCallback(async (o: Open) => {
    const key = favKey(o)
    if (rows.some((x) => x.key === key)) {
      setRows((r) => r.filter((x) => x.key !== key))
      const { error } = await supabase.from('recipe_favorites').delete().eq('key', key)
      if (error) toast(error.message)
    } else {
      const recipe = favData(o)
      setRows((r) => [{ key, recipe }, ...r])
      const { error } = await supabase.from('recipe_favorites').insert({ key, recipe })
      if (error) { toast(error.message); setRows((r) => r.filter((x) => x.key !== key)) } else toast('Saved to favourites ♥')
    }
  }, [rows, toast])
  const list = useMemo(() => rows.map((x) => fromFav(x.recipe)).filter((x): x is Open => !!x), [rows])
  return { list, isFav, toggle }
}

function Heart({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className={`rc-fav${on ? ' on' : ''}`} aria-label={on ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={on} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" /></svg>
    </button>
  )
}

function Card({ o, favs, onOpen, extra }: { o: Open; favs: Favs; onOpen: (o: Open) => void; extra?: ReactNode }) {
  const r = o.r
  return (
    <div className="rc-wrap">
      <button className="rc-card" onClick={() => onOpen(o)}>
        {o.kind === 'own'
          ? <div className="rc-img art" style={{ background: `linear-gradient(135deg, ${HUES[o.r.kind][0]}, ${HUES[o.r.kind][1]})` }}><span>{o.r.emoji}</span></div>
          : <Photo className="rc-img" thumb={o.r.thumb} />}
        <div className="rc-body">
          <b>{r.name}</b>
          {o.kind === 'own'
            ? <span className="small muted">{o.r.kcal} kcal · P {o.r.p} g · {o.r.minutes} min</span>
            : o.r.category && <span className="small muted">{o.r.area ? `${o.r.area} · ` : ''}{o.r.category}</span>}
          {extra}
        </div>
      </button>
      <Heart on={favs.isFav(o)} onClick={() => favs.toggle(o)} />
    </div>
  )
}

type Tab = 'discover' | 'favs' | 'all'

export default function Recipes() {
  const favs = useFavs()
  const [tab, setTab] = useState<Tab>(() => { try { return (localStorage.getItem('recipes-tab') as Tab) || 'discover' } catch { return 'discover' } })
  const [open, setOpen] = useState<Open | null>(null)
  const pick = (t: Tab) => { setTab(t); try { localStorage.setItem('recipes-tab', t) } catch { /* ignore */ } }
  return (
    <>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={tab === 'discover' ? 'on' : ''} onClick={() => pick('discover')}>Discover</button>
        <button className={tab === 'favs' ? 'on' : ''} onClick={() => pick('favs')}>♥ Favourites{favs.list.length ? ` (${favs.list.length})` : ''}</button>
        <button className={tab === 'all' ? 'on' : ''} onClick={() => pick('all')}>All</button>
      </div>
      {tab === 'discover' && <Discover favs={favs} onOpen={setOpen} />}
      {tab === 'favs' && <Favourites favs={favs} onOpen={setOpen} goAll={() => pick('all')} />}
      {tab === 'all' && <AllRecipes favs={favs} onOpen={setOpen} />}
      <p className="small muted" style={{ textAlign: 'center', marginTop: 14 }}>Photos and recipes from TheMealDB</p>
      {open && <RecipeSheet open={open} favs={favs} pantry={readPantry()} onClose={() => setOpen(null)} />}
    </>
  )
}

function readPantry(): string[] { try { return JSON.parse(localStorage.getItem('pantry') || '[]') } catch { return [] } }

function Favourites({ favs, onOpen, goAll }: { favs: Favs; onOpen: (o: Open) => void; goAll: () => void }) {
  if (!favs.list.length) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>♡</div>
        <p style={{ margin: '6px 0 12px' }}>No favourites yet. Tap the heart on any recipe to save it here.</p>
        <button className="btn sm" onClick={goAll}>Browse all recipes</button>
      </div>
    )
  }
  return <FavGrid favs={favs} onOpen={onOpen} />
}

function FavGrid({ favs, onOpen }: { favs: Favs; onOpen: (o: Open) => void }) {
  const m = useMore(favs.list, 10)
  return (
    <>
      <div className="rc-grid">{m.shown.map((o) => <Card key={favKey(o)} o={o} favs={favs} onOpen={onOpen} />)}</div>
      <ShowMore left={m.left} onClick={m.more} />
    </>
  )
}

const PAGE = 10
function AllRecipes({ favs, onOpen }: { favs: Favs; onOpen: (o: Open) => void }) {
  const [db, setDb] = useState<DbRecipe[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [n, setN] = useState(PAGE)
  useEffect(() => { api('all=1').then((b) => setDb(b.recipes ?? [])).catch((e) => { setErr((e as Error).message); setDb([]) }) }, [])
  useEffect(() => setN(PAGE), [q, cat])
  const items = useMemo(() => {
    const own: Open[] = RECIPES.map((r) => ({ kind: 'own', r }))
    const rest: Open[] = (db ?? []).map((r) => ({ kind: 'db', r }))
    let list = cat === 'All' ? [...own, ...rest] : cat === 'Lighter' ? own : rest.filter((o) => o.kind === 'db' && o.r.category === cat)
    const t = q.trim().toLowerCase()
    if (t) list = list.filter((o) => o.r.name.toLowerCase().includes(t))
    return list
  }, [db, q, cat])
  const cats = useMemo(() => ['All', 'Lighter', ...[...new Set((db ?? []).map((r) => r.category ?? ''))].filter(Boolean).sort()], [db])
  return (
    <>
      <input className="input" placeholder="Search all recipes" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <div className="chips scroll" style={{ marginBottom: 8 }}>
        {cats.map((c) => <button key={c} className={`chip${c === cat ? ' on' : ''}`} onClick={() => setCat(c)}>{c === 'Lighter' ? '🥗 Lighter' : c}</button>)}
      </div>
      <p className="small muted" style={{ margin: '0 0 8px' }}>{db ? `${items.length} recipes` : 'Loading recipes…'}</p>
      {err && <div className="small muted" style={{ marginBottom: 8 }}>{err}</div>}
      {!db ? (
        <div className="rc-grid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="rc-card skel" />)}</div>
      ) : items.length === 0 ? (
        <div className="small muted">Nothing found.</div>
      ) : (
        <>
          <div className="rc-grid">{items.slice(0, n).map((o) => <Card key={favKey(o)} o={o} favs={favs} onOpen={onOpen} />)}</div>
          <ShowMore left={items.length - n} onClick={() => setN(n + PAGE)} />
        </>
      )}
    </>
  )
}

function Discover({ favs, onOpen }: { favs: Favs; onOpen: (o: Open) => void }) {
  const [pantry, setPantry] = usePantry()
  const [typed, setTyped] = useState('')
  const [cat, setCat] = useState('Chicken')
  const [q, setQ] = useState('')
  const [db, setDb] = useState<DbRecipe[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const setOpen = onOpen

  const add = (v: string) => {
    const t = v.trim().replace(/,$/, '')
    if (!t) return
    if (!pantry.some((p) => p.toLowerCase() === t.toLowerCase())) setPantry([...pantry, t])
    setTyped('')
  }

  const own = useMemo(() => {
    const list = RECIPES.map((r) => {
      const missing = r.ing.filter((i) => !has(pantry, i.item)).map((i) => i.item.replace(/\s*\(.*\)/, ''))
      return { r, missing, have: r.ing.length - missing.length }
    })
    if (!pantry.length) return list
    return list.filter((x) => x.have > 0 && x.missing.length <= Math.max(2, Math.ceil(x.r.ing.length / 2))).sort((a, b) => a.missing.length - b.missing.length || b.have - a.have)
  }, [pantry])

  // load database recipes: by ingredients if pantry, else search / category
  const key = pantry.length ? 'ing=' + encodeURIComponent(pantry.join(',')) : q.trim().length >= 2 ? 'q=' + encodeURIComponent(q.trim()) : 'cat=' + cat
  useEffect(() => {
    let live = true
    setBusy(true)
    setErr('')
    const t = setTimeout(() => {
      api(key)
        .then((b) => { if (live) setDb(b.recipes ?? []) })
        .catch((e) => { if (live) { setErr((e as Error).message); setDb([]) } })
        .finally(() => { if (live) setBusy(false) })
    }, key.startsWith('q=') ? 400 : 0)
    return () => { live = false; clearTimeout(t) }
  }, [key])

  const dbMore = useMore(db ?? [], 10, key)
  const dbMissing = (r: DbRecipe) => (r.ingredients ?? []).filter((i) => !has(pantry, i.item)).map((i) => i.item)

  return (
    <>
      <section className="card">
        <div className="card-head"><h2>What’s in your kitchen?</h2>{pantry.length > 0 && <button className="link" onClick={() => setPantry([])}>Clear</button>}</div>
        <Autocomplete
          value={typed}
          onChange={(v) => (v.endsWith(',') ? add(v) : setTyped(v))}
          placeholder="Add ingredients, e.g. eggs, spinach, feta"
          suggest={(t) => {
            const cur = t.trim()
            if (cur.length < 2) return []
            return OPTIONS.filter((o) => !pantry.some((p) => p.toLowerCase() === o.toLowerCase()))
              .map((o) => ({ o, s: matchScore(o, cur) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.o.length - b.o.length).slice(0, 6)
              .map(({ o }) => ({ key: o, label: o, onPick: () => add(o) }))
          }}
        />
        {typed.trim() && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => add(typed)}>+ Add “{typed.trim()}”</button>}
        {pantry.length > 0 ? (
          <div className="chips" style={{ marginTop: 10 }}>
            {pantry.map((p) => <button key={p} className="chip on" onClick={() => setPantry(pantry.filter((x) => x !== p))}>{p} ✕</button>)}
          </div>
        ) : (
          <p className="small muted" style={{ margin: '8px 0 0' }}>Add what you have and I’ll show recipes you can make. Basics like oil, salt and spices count as always there.</p>
        )}
      </section>

      <h2 className="sec-title">{pantry.length ? 'You can make (fits your calories)' : 'Lighter recipes (exact macros)'}</h2>
      {own.length === 0 ? <div className="small muted" style={{ marginBottom: 12 }}>No close matches yet. Add a few more ingredients.</div> : (
        <div className="rc-row">
          {own.map(({ r, missing, have }) => (
            <Card key={r.id} o={{ kind: 'own', r }} favs={favs} onOpen={setOpen} extra={pantry.length > 0 && <Match have={have} total={r.ing.length} missing={missing} />} />
          ))}
        </div>
      )}

      <h2 className="sec-title">{pantry.length ? 'More ideas with photos' : 'Recipes with photos'}</h2>
      {!pantry.length && (
        <>
          <input className="input" placeholder="Search recipes, e.g. lasagne" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          {q.trim().length < 2 && (
            <div className="chips scroll" style={{ marginBottom: 10 }}>
              {CATS.map((c) => <button key={c} className={`chip${c === cat ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
            </div>
          )}
        </>
      )}
      {busy && !db?.length ? (
        <div className="rc-grid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="rc-card skel" />)}</div>
      ) : err ? (
        <div className="small muted">{err}</div>
      ) : db && db.length === 0 ? (
        <div className="small muted">Nothing found. Try other ingredients or another word.</div>
      ) : (
        <div className={`rc-grid${busy ? ' dim' : ''}`}>
          {dbMore.shown.map((r) => {
            const miss = pantry.length && r.ingredients ? dbMissing(r) : null
            return <Card key={r.id} o={{ kind: 'db', r }} favs={favs} onOpen={setOpen} extra={miss && <Match have={r.ingredients!.length - miss.length} total={r.ingredients!.length} missing={miss} />} />
          })}
        </div>
      )}
      {!busy && !err && <ShowMore left={dbMore.left} onClick={dbMore.more} />}
    </>
  )
}

function Match({ have, total, missing }: { have: number; total: number; missing: string[] }) {
  return (
    <span className={`rc-match${missing.length === 0 ? ' all' : ''}`}>
      {missing.length === 0 ? '✓ You have everything' : `${have}/${total} · need ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? ` +${missing.length - 2}` : ''}`}
    </span>
  )
}

function guessType(): MealType {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}

function RecipeSheet({ open, favs, pantry, onClose }: { open: Open; favs: Favs; pantry: string[]; onClose: () => void }) {
  const fav = favs.isFav(open)
  const { bump } = useStore()
  const toast = useToast()
  const [added, setAdded] = useState(false)
  async function toList(items: NewItem[]) {
    try { await addItems(items); setAdded(true); toast('Added to your shopping list 🛒') } catch (e) { toast((e as Error).message) }
  }
  const shopItems = (): NewItem[] | null => open.kind === 'own'
    ? open.r.ing.map((i) => ({ name: i.item, qty: i.qty, unit: i.unit, recipe: open.r.name }))
    : detail?.ingredients ? detail.ingredients.map((i) => ({ name: i.item, note: i.measure || null, recipe: detail.name })) : null
  const favBtn = () => (
    <div className="row" style={{ gap: 8 }}>
      <button className={`btn ghost rc-favbtn grow${fav ? ' on' : ''}`} onClick={() => favs.toggle(open)}>{fav ? '♥ Favourite' : '♡ Favourite'}</button>
      <button className="btn ghost rc-favbtn grow" disabled={added || !shopItems()} onClick={() => { const it = shopItems(); if (it) toList(it) }}>{added ? '✓ On your list' : '🛒 Add to list'}</button>
    </div>
  )
  const [detail, setDetail] = useState<DbRecipe | null>(open.kind === 'db' && open.r.ingredients ? open.r : null)
  const [est, setEst] = useState<{ kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open.kind !== 'db' || detail) return
    api('id=' + open.r.id).then((b) => setDetail(b.recipe)).catch((e) => toast((e as Error).message))
  }, [open, detail, toast])

  async function log(m: { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }) {
    const { error } = await supabase.from('meal_logs').insert({ ...m, meal_type: guessType(), source: 'plan' })
    if (error) return toast(error.message)
    toast('Logged ✓')
    bump()
    onClose()
  }

  async function estimate(r: DbRecipe) {
    setBusy(true)
    try {
      const ing = (r.ingredients ?? []).map((i) => `${i.measure} ${i.item}`.trim()).join(', ')
      const d = await askAI({ text: `One serving of "${r.name}" (whole recipe serves 4 unless obvious). Whole recipe: ${ing}`.slice(0, 495) })
      setEst({ kcal: d.kcal, protein_g: d.protein_g, carbs_g: d.carbs_g, fat_g: d.fat_g })
    } catch (e) {
      toast((e as Error).message)
    }
    setBusy(false)
  }

  if (open.kind === 'own') {
    const r = open.r
    return (
      <Sheet title={r.name} onClose={onClose}>
        <div className="rc-hero art" style={{ background: `linear-gradient(135deg, ${HUES[r.kind][0]}, ${HUES[r.kind][1]})` }}><span>{r.emoji}</span></div>
        <div className="grid4">
          <Stat v={r.kcal} l="kcal" /><Stat v={r.p} l="protein g" /><Stat v={r.c} l="carbs g" /><Stat v={r.f} l="fat g" />
        </div>
        <p className="small muted">⏱ {r.minutes} min · 1 serving</p>
        {favBtn()}
        <h3>Ingredients</h3>
        <ul className="ing-list">
          {r.ing.map((i) => <Ing key={i.item} ok={has(pantry, i.item)} show={pantry.length > 0} text={`${i.qty} ${i.unit} ${i.item}`} />)}
        </ul>
        <h3>Steps</h3>
        <ol className="rc-steps">{r.steps.map((s, n) => <li key={n}>{s}</li>)}</ol>
        <button className="btn" style={{ width: '100%' }} onClick={() => log({ name: r.name, kcal: r.kcal, protein_g: r.p, carbs_g: r.c, fat_g: r.f })}>Log 1 serving · {r.kcal} kcal</button>
      </Sheet>
    )
  }

  const r = detail ?? open.r
  return (
    <Sheet title={r.name} onClose={onClose}>
      <img className="rc-hero" src={r.thumb} alt={r.name} decoding="async" />
      {r.area && <p className="small muted">{r.area} · {r.category}</p>}
      {favBtn()}
      {est ? (
        <>
          <div className="grid4">
            <Stat v={est.kcal} l="kcal" /><Stat v={Math.round(est.protein_g)} l="protein g" /><Stat v={Math.round(est.carbs_g)} l="carbs g" /><Stat v={Math.round(est.fat_g)} l="fat g" />
          </div>
          <p className="small muted">AI estimate for 1 serving</p>
        </>
      ) : (
        <button className="btn ghost" style={{ width: '100%', marginBottom: 10 }} disabled={busy || !detail} onClick={() => estimate(r)}>{busy ? 'Estimating…' : '✨ Estimate calories per serving'}</button>
      )}
      {!detail ? <div className="empty">Loading recipe…</div> : (
        <>
          <h3>Ingredients</h3>
          <ul className="ing-list">
            {(r.ingredients ?? []).map((i, n) => <Ing key={n} ok={has(pantry, i.item)} show={pantry.length > 0} text={`${i.measure} ${i.item}`.trim()} />)}
          </ul>
          <h3>Steps</h3>
          <ol className="rc-steps">{(r.steps ?? []).map((s, n) => <li key={n}>{s}</li>)}</ol>
          {r.youtube && <a className="link" href={r.youtube} target="_blank" rel="noreferrer">▶ Watch video</a>}
        </>
      )}
      {est && <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => log({ name: r.name, ...est })}>Log 1 serving · {est.kcal} kcal</button>}
    </Sheet>
  )
}

const Stat = ({ v, l }: { v: number; l: string }) => <div className="rc-stat"><b className="num">{v}</b><span>{l}</span></div>
const Ing = ({ ok, show, text }: { ok: boolean; show: boolean; text: string }) => (
  <li className={show ? (ok ? 'have' : 'miss') : ''}>{show ? (ok ? '✓ ' : '○ ') : ''}{text}</li>
)
