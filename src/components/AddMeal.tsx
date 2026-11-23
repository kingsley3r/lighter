import { useEffect, useRef, useState } from 'react'
import { Seg, Sheet, useToast, ShowMore, useMore } from './ui'
import { lookupBarcode, scale, searchFoods, type FoodItem } from '../lib/food'
import { supabase } from '../lib/supabase'
import { guessMealType, recentFoods, type RecentFood } from '../lib/data'
import type { MealType } from '../lib/types'
import Autocomplete, { type Suggestion } from './Autocomplete'
import Restaurant from './Restaurant'
import { matchScore, parseQty, suggestFoods, type CommonFood } from '../data/common-foods'

type Mode = 'photo' | 'text' | 'search' | 'recent' | 'barcode'

interface Draft {
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  source: 'manual' | 'search' | 'barcode' | 'photo'
  notes?: string
}

const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
]

const fmtQty = (q: number) => (q === 1 ? '' : `${q % 1 ? q.toFixed(1) : q} × `)
const commonDraft = (f: CommonFood & { qty: number }): Draft => ({
  name: f.qty === 1 ? f.name : `${f.name} (${fmtQty(f.qty).replace(' × ', '×')})`,
  kcal: Math.round(f.kcal * f.qty),
  protein_g: Math.round(f.p * f.qty * 10) / 10,
  carbs_g: Math.round(f.c * f.qty * 10) / 10,
  fat_g: Math.round(f.f * f.qty * 10) / 10,
  source: 'manual',
  notes: `${fmtQty(f.qty)}${f.portion}`,
})

let recentCache: RecentFood[] | null = null
function useRecents() {
  const [r, setR] = useState<RecentFood[]>(recentCache ?? [])
  useEffect(() => {
    if (!recentCache) recentFoods().then((x) => { recentCache = x; setR(x) })
  }, [])
  return r
}

/** Your own recent foods first, then everyday foods and drinks. */
function foodSuggestions(text: string, recents: RecentFood[], onDraft: (d: Draft) => void, limit = 7): Suggestion[] {
  const { qty, rest } = parseQty(text)
  if (rest.trim().length < 2) return []
  const q = qty ?? 1
  const mine: Suggestion[] = recents
    .map((r) => ({ r, s: matchScore(r.name, rest) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(({ r }) => ({
      key: 'r' + r.name + r.kcal,
      label: r.name,
      sub: q === 1 ? 'You logged this before' : `${q} × your usual portion`,
      right: `${Math.round(r.kcal * q)} kcal`,
      onPick: () => onDraft({ name: r.name, kcal: Math.round(r.kcal * q), protein_g: Math.round(r.protein_g * q * 10) / 10, carbs_g: Math.round(r.carbs_g * q * 10) / 10, fat_g: Math.round(r.fat_g * q * 10) / 10, source: 'manual' }),
    }))
  const common: Suggestion[] = suggestFoods(text, { limit })
    .filter((f) => !mine.some((m) => m.key === 'r' + f.name + f.kcal))
    .map((f) => ({
      key: 'c' + f.name,
      label: f.name,
      sub: `${fmtQty(f.qty)}${f.portion} · P ${Math.round(f.p * f.qty)} g · C ${Math.round(f.c * f.qty)} g · F ${Math.round(f.f * f.qty)} g`,
      right: `${Math.round(f.kcal * f.qty)} kcal`,
      onPick: () => onDraft(commonDraft(f)),
    }))
  return [...mine, ...common].slice(0, limit)
}

export default function AddMeal({ onClose, onSaved, date, eatingOut = false }: { onClose: () => void; onSaved: () => void; date?: Date; eatingOut?: boolean }) {
  const [mode, setMode] = useState<Mode>('photo')
  const [out, setOut] = useState(eatingOut)
  const [food, setFood] = useState<FoodItem | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const pickFood = (f: FoodItem, source: 'search' | 'barcode') => {
    setFood(f)
    const g = f.servingG ?? 100
    setDraft({ name: f.brand ? `${f.name} (${f.brand})` : f.name, ...scale(f, g), source, notes: `${g} g` })
  }

  return (
    <Sheet title={out && !draft ? 'Eating out' : 'Log food'} onClose={onClose}>
      {!draft && out && (
        <>
          <button className="link" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={() => setOut(false)}>‹ Other ways to log</button>
          <Restaurant onLog={(d) => setDraft(d)} />
        </>
      )}
      {!draft && !out && (
        <>
          <Seg<Mode>
            options={[
              { id: 'photo', label: 'Photo' },
              { id: 'text', label: 'Describe' },
              { id: 'search', label: 'Search' },
              { id: 'recent', label: 'Recent' },
              { id: 'barcode', label: 'Barcode' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <button className="out-entry" onClick={() => setOut(true)}>🍽️ <b>Eating out?</b> <span className="muted">Check a dish or menu before you order</span> <span className="muted">›</span></button>
          <div style={{ marginTop: 14 }}>
            {mode === 'photo' && <PhotoScan onResult={(d) => setDraft(d)} />}
            {mode === 'text' && <Describe onResult={(d) => setDraft(d)} onDraft={setDraft} />}
            {mode === 'search' && <Search onPick={(f) => pickFood(f, 'search')} onDraft={setDraft} />}
            {mode === 'recent' && <Recent onPick={(r) => setDraft({ name: r.name, kcal: r.kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, source: 'manual'})} />}
            {mode === 'barcode' && <Barcode onPick={(f) => pickFood(f, 'barcode')} />}
            <button className="link" style={{ marginTop: 12, paddingLeft: 0 }} onClick={() => setDraft({ name: '', kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, source: 'manual' })}>Enter calories manually</button>
          </div>
        </>
      )}
      {draft && <Confirm draft={draft} food={food} date={date} onBack={() => { setDraft(null); setFood(null) }} onSaved={() => { onSaved(); onClose() }} />}
    </Sheet>
  )
}

function Confirm({ draft, food, date, onBack, onSaved }: { draft: Draft; food: FoodItem | null; date?: Date; onBack: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [d, setD] = useState<Draft>(draft)
  const [grams, setGrams] = useState<number>(food?.servingG ?? 100)
  const [type, setType] = useState<MealType>(guessMealType())
  const [busy, setBusy] = useState(false)
  const recents = useRecents()

  const setGramsAndScale = (g: number) => {
    setGrams(g)
    if (food) setD((x) => ({ ...x, ...scale(food, g), notes: `${g} g` }))
  }
  const n = (v: string) => Number(v.replace(',', '.')) || 0

  async function save() {
    setBusy(true)
    let eaten = new Date()
    if (date) {
      eaten = new Date(date)
      const now = new Date()
      eaten.setHours(now.getHours(), now.getMinutes())
    }
    const { error } = await supabase.from('meal_logs').insert({ ...d, name: d.name || 'Food', meal_type: type, eaten_at: eaten.toISOString() })
    setBusy(false)
    if (error) return toast(error.message)
    toast('Logged ✓')
    onSaved()
  }

  return (
    <div>
      <label className="field"><span>What</span>
        {food ? (
          <input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Pasta bolognese" />
        ) : (
          <Autocomplete value={d.name} onChange={(v) => setD({ ...d, name: v })} suggest={(t) => (t === draft.name && draft.kcal > 0 ? [] : foodSuggestions(t, recents, (x) => setD({ ...x, source: d.source === 'photo' ? 'photo' : x.source })))} placeholder="e.g. Pasta bolognese" />
        )}
      </label>
      {food && (
        <label className="field"><span>Amount (g) · {food.kcal100} kcal per 100 g</span>
          <div className="row">
            <input className="input grow" inputMode="decimal" value={grams} onChange={(e) => setGramsAndScale(n(e.target.value))} />
            {food.servingG && <button className="btn ghost sm" onClick={() => setGramsAndScale(food.servingG!)}>1 serving</button>}
          </div>
        </label>
      )}
      <div className="grid2">
        <label className="field"><span>Calories (kcal)</span><input className="input" inputMode="numeric" value={d.kcal} onChange={(e) => setD({ ...d, kcal: Math.round(n(e.target.value)) })} /></label>
        <label className="field"><span>Protein (g)</span><input className="input" inputMode="decimal" value={d.protein_g} onChange={(e) => setD({ ...d, protein_g: n(e.target.value) })} /></label>
        <label className="field"><span>Carbs (g)</span><input className="input" inputMode="decimal" value={d.carbs_g} onChange={(e) => setD({ ...d, carbs_g: n(e.target.value) })} /></label>
        <label className="field"><span>Fat (g)</span><input className="input" inputMode="decimal" value={d.fat_g} onChange={(e) => setD({ ...d, fat_g: n(e.target.value) })} /></label>
      </div>
      {(d.source === 'photo' || d.notes?.startsWith('AI')) && d.notes && <p className="small muted" style={{ marginTop: -4 }}>{d.notes}</p>}
      <label className="field"><span>Meal</span>
        <Seg<MealType> options={MEAL_TYPES} value={type} onChange={setType} />
      </label>
      <div className="row">
        <button className="btn ghost" onClick={onBack}>Back</button>
        <button className="btn grow" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}

function Search({ onPick, onDraft }: { onPick: (f: FoodItem) => void; onDraft: (d: Draft) => void }) {
  const [q, setQ] = useState('')
  const recents = useRecents()
  const [res, setRes] = useState<FoodItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (parseQty(q).rest.trim().length < 3) {
      setRes(null)
      return
    }
    const ctl = new AbortController()
    const t = window.setTimeout(async () => {
      setLoading(true)
      setErr(null)
      try {
        setRes(await searchFoods(parseQty(q).rest.trim(), ctl.signal))
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setErr((e as Error).message)
      }
      setLoading(false)
    }, 450)
    return () => {
      ctl.abort()
      window.clearTimeout(t)
    }
  }, [q])

  const more = useMore(res ?? [], 10, res)
  return (
    <div>
      <Autocomplete autoFocus placeholder="Search food, drink or product…" value={q} onChange={setQ} suggest={(t) => foodSuggestions(t, recents, onDraft)} />
      <p className="small muted">Type a few letters for quick picks, e.g. “2 egg”. Products below come from Open Food Facts.</p>
      {loading && <div className="empty">Searching…</div>}
      {err && <div className="empty">{err}</div>}
      {res && !loading && res.length === 0 && <div className="empty">Nothing found. Try another word, or use Quick.</div>}
      {res && !loading && (
        <div className="card" style={{ padding: '8px 14px' }}>
          {more.shown.map((f) => (
            <button key={f.code + f.name} className="list-item" style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer' }} onClick={() => onPick(f)}>
              <div className="grow">
                <div className="title">{f.name}</div>
                <div className="small muted">{f.brand ?? ''}</div>
              </div>
              <div className="small num muted">{f.kcal100} kcal/100 g</div>
            </button>
          ))}
        </div>
      )}
      {res && !loading && <ShowMore left={more.left} onClick={more.more} />}
    </div>
  )
}

function Barcode({ onPick }: { onPick: (f: FoodItem) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState('Starting camera…')
  const [manual, setManual] = useState('')
  const done = useRef(false)

  const lookup = async (code: string) => {
    setStatus(`Looking up ${code}…`)
    const f = await lookupBarcode(code).catch(() => null)
    if (f) onPick(f)
    else {
      done.current = false
      setStatus('Product not found. Try again or use Search.')
    }
  }

  useEffect(() => {
    let controls: { stop: () => void } | null = null
    let cancelled = false
    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        if (cancelled || !video.current) return
        controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current, (result) => {
          if (result && !done.current) {
            done.current = true
            controls?.stop()
            lookup(result.getText())
          }
        })
        setStatus('Point the camera at a barcode')
      } catch {
        setStatus('Camera not available. Type the number below.')
      }
    })()
    return () => {
      cancelled = true
      controls?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="scanner">
      <video ref={video} playsInline muted />
      <p className="small muted" style={{ textAlign: 'center' }}>{status}</p>
      <div className="row">
        <input className="input grow" inputMode="numeric" placeholder="Barcode number" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn" disabled={manual.length < 6} onClick={() => lookup(manual)}>Find</button>
      </div>
    </div>
  )
}

async function downscale(file: File, max = 1024): Promise<string> {
  const img = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

interface ScanItem { name: string; grams: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number }

export async function askAI(payload: Record<string, unknown>): Promise<Draft> {
  const { data: s } = await supabase.auth.getSession()
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'AI estimate failed. Try Search instead.')
  const items: ScanItem[] = body.items ?? []
  if (!items.length) throw new Error('No food recognised. Try again or use Search.')
  const tot = (k: keyof ScanItem) => Math.round(items.reduce((a, x) => a + Number(x[k] || 0), 0) * 10) / 10
  return {
    name: body.title || items.map((x) => x.name).join(', '),
    kcal: Math.round(tot('kcal')),
    protein_g: tot('protein_g'),
    carbs_g: tot('carbs_g'),
    fat_g: tot('fat_g'),
    source: payload.image ? 'photo' : 'manual',
    notes: 'AI estimate: ' + items.map((x) => `${x.name} ~${Math.round(x.grams)} g`).join(' · ') + '. Adjust if needed.',
  }
}

function Describe({ onResult, onDraft }: { onResult: (d: Draft) => void; onDraft: (d: Draft) => void }) {
  const [text, setText] = useState('')
  const recents = useRecents()
  // Suggest for the phrase being typed (after the last comma / "and"); picking completes that phrase
  const suggest = (t: string): Suggestion[] => {
    const seps = [...t.matchAll(/(,|;|\n|\s(?:and|und|plus)\s)\s*/gi)]
    const last = seps[seps.length - 1]
    const cut = last ? last.index! + last[0].length : 0
    const head = t.slice(0, cut)
    const cur = t.slice(cut)
    const items = foodSuggestions(cur, recents, () => {}, 5)
    return items.map((it) => {
      const { qty } = parseQty(cur)
      const name = typeof it.label === 'string' ? it.label : ''
      return {
        ...it,
        onPick: () => {
          setText(head + (qty && qty !== 1 ? `${qty} ` : '') + name.toLowerCase() + ', ')
        },
      }
    })
  }
  const quick = !/[,;\n]|\band\b/i.test(text.trim().replace(/,\s*$/, '')) ? foodSuggestions(text.replace(/,\s*$/, ''), recents, onDraft, 1)[0] : undefined
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function go() {
    setBusy(true)
    setErr(null)
    try {
      onResult(await askAI({ text }))
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }
  return (
    <div>
      <label className="field"><span>What did you eat? Write it like you’d tell a friend.</span>
        <Autocomplete multiline value={text} onChange={setText} suggest={suggest} placeholder="e.g. 2 scrambled eggs, a slice of wholegrain toast with butter and a latte" />
      </label>
      {quick && (
        <button className="btn outline block" style={{ marginBottom: 8 }} onClick={quick.onPick}>
          Log “{quick.label}” · {quick.right}
        </button>
      )}
      <button className="btn block" disabled={busy || text.trim().length < 3} onClick={go}>{busy ? 'Estimating…' : 'Estimate calories'}</button>
      {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
      <p className="small muted">The AI splits your text into foods and estimates portions. You can correct everything before saving.</p>
    </div>
  )
}

function Recent({ onPick }: { onPick: (r: RecentFood) => void }) {
  const [list, setList] = useState<RecentFood[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    recentFoods().then(setList)
  }, [])
  const shownAll = !list ? [] : q ? list.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())) : list
  const more = useMore(shownAll, 10, q)
  if (!list) return <div className="empty">Loading…</div>
  if (!list.length) return <div className="empty">Foods you log show up here, so you can add them again with one tap.</div>
  return (
    <div>
      {list.length > 8 && <input className="input" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />}
      <div className="card" style={{ padding: '8px 14px' }}>
        {more.shown.map((r) => (
          <button key={r.name + r.kcal} className="list-item" style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer' }} onClick={() => onPick(r)}>
            <div className="grow">
              <div className="title">{r.name}</div>
              <div className="small muted">P {Math.round(r.protein_g)} · C {Math.round(r.carbs_g)} · F {Math.round(r.fat_g)}{r.count > 1 ? ` · logged ${r.count}×` : ''}</div>
            </div>
      <ShowMore left={more.left} onClick={more.more} />
            <div className="small num muted">{r.kcal} kcal</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function PhotoScan({ onResult }: { onResult: (d: Draft) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr(null)
    setBusy(true)
    try {
      const dataUrl = await downscale(f)
      setPreview(dataUrl)
      onResult(await askAI({ image: dataUrl, hint }))
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {preview && <img src={preview} alt="" style={{ width: '100%', borderRadius: 14, marginBottom: 10, maxHeight: 260, objectFit: 'cover' }} />}
      <label className="field"><span>Anything the photo can’t show? (optional)</span>
        <input className="input" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. cooked with butter, large plate" />
      </label>
      <button className="btn block" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Analysing your meal…' : preview ? 'Take another photo' : '📷 Take a photo of your meal'}
      </button>
      {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
      <p className="small muted">The AI estimates the dish, portion size, calories and macros. You can correct everything before saving.</p>
    </div>
  )
}
