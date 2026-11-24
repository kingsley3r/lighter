import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { addDays, isoDate, parseDate } from '../lib/dates'
import { Sheet, useToast } from './ui'

interface Habit { id: number; name: string; emoji: string; archived: boolean }
interface Check { habit_id: number; day: string }

const PRESETS = [
  { emoji: '🍬', name: 'No sugar' }, { emoji: '😴', name: '8 h sleep' }, { emoji: '🧘', name: 'Stretch 10 min' },
  { emoji: '🍺', name: 'No alcohol' }, { emoji: '📖', name: 'Read 20 min' }, { emoji: '🥗', name: 'Veggies with every meal' },
  { emoji: '📵', name: 'No phone in bed' }, { emoji: '🚶', name: 'Walk after dinner' },
]
const WEEKS = 15

/** Current streak: consecutive checked days ending today (or yesterday, so today isn't "broken" before you check it). */
export function streakOf(days: Set<string>): { current: number; best: number } {
  let current = 0
  let d = new Date()
  if (!days.has(isoDate(d))) d = addDays(d, -1)
  while (days.has(isoDate(d))) { current++; d = addDays(d, -1) }
  const sorted = [...days].sort()
  let best = 0, run = 0, prev: string | null = null
  for (const k of sorted) { run = prev && isoDate(addDays(parseDate(prev), 1)) === k ? run + 1 : 1; best = Math.max(best, run); prev = k }
  return { current, best }
}

function useHabits() {
  const { version } = useStore()
  const [habits, setHabits] = useState<Habit[]>([])
  const [checks, setChecks] = useState<Check[]>([])
  const load = useCallback(async () => {
    const from = isoDate(addDays(new Date(), -WEEKS * 7 - 7))
    const [h, c] = await Promise.all([
      supabase.from('habits').select('id,name,emoji,archived').eq('archived', false).order('created_at'),
      supabase.from('habit_checks').select('habit_id,day').gte('day', from),
    ])
    setHabits((h.data ?? []) as Habit[])
    setChecks((c.data ?? []) as Check[])
  }, [])
  useEffect(() => { load() }, [load, version])
  const daysFor = (id: number) => new Set(checks.filter((c) => c.habit_id === id).map((c) => c.day))
  async function toggle(id: number, day = isoDate()) {
    const on = checks.some((c) => c.habit_id === id && c.day === day)
    setChecks(on ? checks.filter((c) => !(c.habit_id === id && c.day === day)) : [...checks, { habit_id: id, day }])
    const r = on ? await supabase.from('habit_checks').delete().eq('habit_id', id).eq('day', day) : await supabase.from('habit_checks').insert({ habit_id: id, day })
    if (r.error) load()
    return !on
  }
  return { habits, checks, daysFor, toggle, load }
}

/** Today card: tick off habits, see streaks. */
export function HabitsCard() {
  const { habits, daysFor, toggle } = useHabits()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const today = isoDate()
  return (
    <section className="card">
      <div className="card-head"><h2>Habits</h2><button className="btn ghost sm" onClick={() => setOpen(true)}>{habits.length ? 'Streaks' : '+ Add'}</button></div>
      {!habits.length ? (
        <p className="small muted" style={{ margin: 0 }}>Pick a few small daily habits like “no sugar” or “stretch” and build streaks.</p>
      ) : (
        <div className="habit-list">
          {habits.map((h) => {
            const days = daysFor(h.id), done = days.has(today), s = streakOf(days)
            return (
              <button key={h.id} className={`habit-row${done ? ' done' : ''}`} onClick={async () => { const on = await toggle(h.id); if (on && [3, 7, 14, 30, 50, 100].includes(s.current + 1)) toast(`${s.current + 1}-day streak: ${h.name} 🔥`) }}>
                <span className="habit-check">{done ? '✓' : ''}</span>
                <span className="habit-emoji">{h.emoji}</span>
                <span className="grow">{h.name}</span>
                {(done ? s.current : s.current) > 0 && <span className="pill accent small">🔥 {s.current}</span>}
              </button>
            )
          })}
        </div>
      )}
      {open && <HabitsSheet onClose={() => setOpen(false)} />}
    </section>
  )
}

/** Heatmaps, streaks, add and remove habits. */
function HabitsSheet({ onClose }: { onClose: () => void }) {
  const { habits, daysFor, toggle, load } = useHabits()
  const { bump } = useStore()
  const toast = useToast()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('✅')

  async function add(n: string, e: string) {
    if (!n.trim()) return
    if (habits.length >= 8) return toast('8 habits max. Small and steady wins.')
    const { error } = await supabase.from('habits').insert({ name: n.trim().slice(0, 40), emoji: e })
    if (error) return toast(error.message)
    setName(''); setEmoji('✅'); await load(); bump()
  }
  async function remove(h: Habit) {
    if (!confirm(`Remove “${h.name}”? Your streak history is kept.`)) return
    await supabase.from('habits').update({ archived: true }).eq('id', h.id)
    await load(); bump()
  }

  // grid starts on the Monday WEEKS-1 weeks ago
  const now = new Date()
  const monday = addDays(now, -((now.getDay() + 6) % 7) - (WEEKS - 1) * 7)
  const today = isoDate()

  return (
    <Sheet title="Habits" onClose={onClose}>
      {habits.map((h) => {
        const days = daysFor(h.id), s = streakOf(days)
        const last30 = Array.from({ length: 30 }, (_, i) => isoDate(addDays(now, -i))).filter((d) => days.has(d)).length
        return (
          <div key={h.id} className="card habit-card">
            <div className="row between">
              <b>{h.emoji} {h.name}</b>
              <button className="link small" onClick={() => remove(h)}>Remove</button>
            </div>
            <div className="row small muted" style={{ gap: 14, margin: '4px 0 10px' }}>
              <span>🔥 <b className="num">{s.current}</b> now</span><span>🏆 <b className="num">{s.best}</b> best</span><span><b className="num">{Math.round((last30 / 30) * 100)}%</b> last 30 days</span>
            </div>
            <div className="heatmap" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
              {Array.from({ length: WEEKS * 7 }, (_, i) => {
                const col = Math.floor(i / 7), row = i % 7
                const d = isoDate(addDays(monday, col * 7 + row))
                const future = d > today
                return <button key={i} style={{ gridColumn: col + 1, gridRow: row + 1 }} className={`hm${days.has(d) ? ' on' : ''}${d === today ? ' today' : ''}`} disabled={future} aria-label={`${d}${days.has(d) ? ' done' : ''}`} onClick={() => toggle(h.id, d)} />
              })}
            </div>
            <div className="row between small muted" style={{ marginTop: 4 }}><span>{WEEKS} weeks ago</span><span>Today</span></div>
          </div>
        )
      })}
      {habits.length > 0 && <p className="small muted" style={{ marginTop: 0 }}>Tap a square to fix a past day.</p>}

      <h3 style={{ margin: '16px 0 8px' }}>Add a habit</h3>
      <div className="chips">
        {PRESETS.filter((p) => !habits.some((h) => h.name === p.name)).map((p) => <button key={p.name} className="chip" onClick={() => add(p.name, p.emoji)}>{p.emoji} {p.name}</button>)}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <input className="input" style={{ width: 58, textAlign: 'center' }} value={emoji} onChange={(e) => setEmoji([...e.target.value].slice(-1).join('') || '✅')} aria-label="Emoji" />
        <input className="input grow" placeholder="Your own habit" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(name, emoji) }} />
        <button className="btn" disabled={!name.trim()} onClick={() => add(name, emoji)}>Add</button>
      </div>
    </Sheet>
  )
}
