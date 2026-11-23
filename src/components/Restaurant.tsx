import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { dayRange, mealsBetween, sum } from '../lib/data'
import { useToast } from './ui'

export interface Dish { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; verdict: 'great' | 'ok' | 'heavy'; tip: string }
interface Result { restaurant_note: string; dishes: Dish[] }
export interface OutDraft { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; source: 'manual'; notes?: string }

const CHAINS = ['McDonald’s', 'Burger King', 'KFC', 'Subway', 'Starbucks', 'Domino’s', 'Pizza Hut', 'Vapiano', 'L’Osteria', 'Five Guys', 'Nando’s', 'Dean & David', 'Hans im Glück', 'Sushi', 'Italian', 'Indian', 'Thai', 'Chinese', 'Mexican', 'Greek', 'Döner / Kebab', 'Burger place', 'Steakhouse', 'Café / bakery']
const VERDICT = { great: { label: 'Great pick', cls: 'great' }, ok: { label: 'Okay', cls: 'ok' }, heavy: { label: 'Heavy', cls: 'heavy' } } as const

async function shrink(file: File, max = 1400): Promise<string> {
  const img = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

/** “Eating out” helper: estimate a dish (or a whole menu photo) before ordering. */
export default function Restaurant({ onLog }: { onLog: (d: OutDraft) => void }) {
  const toast = useToast()
  const { profile } = useStore()
  const [place, setPlace] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<null | 'text' | 'photo'>(null)
  const [res, setRes] = useState<Result | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const r = dayRange(new Date())
    mealsBetween(r.from, r.to).then((m) => setLeft((profile?.kcal_target ?? 2000) - sum(m, (x) => x.kcal)))
  }, [profile?.kcal_target])

  async function ask(payload: Record<string, unknown>, kind: 'text' | 'photo') {
    setBusy(kind)
    setRes(null)
    try {
      const { data: s } = await supabase.auth.getSession()
      const r = await fetch('/api/restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
        body: JSON.stringify({ ...payload, place, kcal_left: left }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error || 'Could not estimate. Try again.')
      const order = { great: 0, ok: 1, heavy: 2 }
      setRes({ restaurant_note: body.restaurant_note, dishes: [...body.dishes].sort((a: Dish, b: Dish) => order[a.verdict] - order[b.verdict] || a.kcal - b.kcal) })
    } catch (e) { toast((e as Error).message) }
    setBusy(null)
  }

  return (
    <div className="out">
      <p className="small muted" style={{ marginTop: 0 }}>Check a dish before you order. {left != null && <b style={{ color: left > 0 ? 'var(--accent)' : 'var(--warn)' }}>{left > 0 ? `${left} kcal left today.` : `${-left} kcal over today.`}</b>}</p>
      <label className="field"><span>Where are you? (optional)</span>
        <input className="input" list="out-chains" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Vapiano, Thai, Burger place" />
        <datalist id="out-chains">{CHAINS.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 2) ask({ text }, 'text') }}>
        <label className="field"><span>What are you thinking of ordering?</span>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Big Mac menu, pad thai, carbonara" />
        </label>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn grow" disabled={!!busy || text.trim().length < 2}>{busy === 'text' ? 'Estimating…' : '✨ Estimate'}</button>
          <button type="button" className="btn ghost grow" disabled={!!busy} onClick={() => file.current?.click()}>{busy === 'photo' ? 'Reading menu…' : '📷 Scan menu'}</button>
        </div>
      </form>
      <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = ''
        if (f) ask({ image: await shrink(f), text }, 'photo')
      }} />

      {res && (
        <div className="out-res">
          {res.restaurant_note && <p className="small out-note">💡 {res.restaurant_note}</p>}
          {res.dishes.map((d, i) => {
            const fits = left != null && d.kcal <= left
            return (
              <div key={i} className={`out-dish ${VERDICT[d.verdict].cls}`}>
                <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <b>{d.name}</b>
                  <span className={`out-badge ${VERDICT[d.verdict].cls}`}>{VERDICT[d.verdict].label}</span>
                </div>
                <div className="small muted num">~{Math.round(d.kcal)} kcal · P {Math.round(d.protein_g)} · C {Math.round(d.carbs_g)} · F {Math.round(d.fat_g)}{left != null ? (fits ? ' · fits today ✓' : ` · ${Math.round(d.kcal - left)} over`) : ''}</div>
                {d.tip && <div className="small out-tip">👉 {d.tip}</div>}
                <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => onLog({ name: (place ? `${d.name} (${place})` : d.name), kcal: Math.round(d.kcal), protein_g: Math.round(d.protein_g), carbs_g: Math.round(d.carbs_g), fat_g: Math.round(d.fat_g), source: 'manual', notes: 'Restaurant estimate by AI. Adjust if needed.' })}>I ordered this → log it</button>
              </div>
            )
          })}
          <p className="small muted">AI estimates for a typical restaurant portion. Real values vary.</p>
        </div>
      )}
    </div>
  )
}
