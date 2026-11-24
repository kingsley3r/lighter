import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { dayRange, mealsBetween, sleepSince, sum, waterBetween, workoutsBetween } from '../lib/data'
import { isoDate } from '../lib/dates'
import { stepsSince } from '../lib/steps'
import { earnCoins } from '../lib/coins'
import type { Profile } from '../lib/types'
import { useToast } from './ui'

export const QUEST_COINS = 10

interface Ctx { p: Profile; kcal: number; protein: number; meals: number; water: number; steps: number; workouts: number; weighed: boolean; checkin: boolean; habitsDone: number; habitsTotal: number; played: boolean }
interface Quest { id: string; icon: string; title: string; progress: (c: Ctx) => [number, number] }

const POOL: Quest[] = [
  { id: 'water', icon: '💧', title: 'Drink your water goal', progress: (c) => [c.water, c.p.water_target_ml ?? 2500] },
  { id: 'protein', icon: '🍗', title: 'Hit 80% of your protein', progress: (c) => [Math.round(c.protein), Math.round((c.p.protein_target_g ?? 120) * 0.8)] },
  { id: 'log3', icon: '📝', title: 'Log 3 meals', progress: (c) => [c.meals, 3] },
  { id: 'walk', icon: '🚶', title: 'Walk 6,000 steps', progress: (c) => [c.steps, 6000] },
  { id: 'move', icon: '🏋️', title: 'Do any workout', progress: (c) => [c.workouts, 1] },
  { id: 'weigh', icon: '⚖️', title: 'Weigh in', progress: (c) => [c.weighed ? 1 : 0, 1] },
  { id: 'morning', icon: '☀️', title: 'Do the morning check-in', progress: (c) => [c.checkin ? 1 : 0, 1] },
  { id: 'habits', icon: '🔥', title: 'Tick off all your habits', progress: (c) => (c.habitsTotal ? [c.habitsDone, c.habitsTotal] : [0, 1]) },
  { id: 'game', icon: '🎮', title: 'Play Snack Catch', progress: (c) => [c.played ? 1 : 0, 1] },
]

/** Three quests per day, the same all day, picked from the date. Habit quest only if you have habits. */
function pick(day: string, hasHabits: boolean): Quest[] {
  const pool = POOL.filter((q) => hasHabits || q.id !== 'habits')
  let seed = [...day].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const out: Quest[] = []
  const left = [...pool]
  while (out.length < 3 && left.length) { seed = (seed * 1103515245 + 12345) >>> 0; out.push(left.splice(seed % left.length, 1)[0]) }
  return out
}

/** Today card with 3 small daily quests. Done quests can be claimed for coins. */
export function QuestsCard() {
  const { profile, version, refreshProfile } = useStore()
  const toast = useToast()
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [claimed, setClaimed] = useState<Set<string>>(new Set())
  const [habitsN, setHabitsN] = useState(0)
  const today = isoDate()

  useEffect(() => {
    if (!profile) return
    const r = dayRange(new Date())
    Promise.all([
      mealsBetween(r.from, r.to), waterBetween(r.from, r.to), stepsSince(today), workoutsBetween(r.from, r.to),
      supabase.from('weight_logs').select('id').eq('logged_on', today), sleepSince(today),
      supabase.from('habits').select('id').eq('archived', false), supabase.from('habit_checks').select('habit_id').eq('day', today),
      supabase.from('coin_log').select('src').eq('day', today),
    ]).then(([meals, water, steps, wo, w, sl, h, hc, coins]) => {
      const types = new Set(meals.map((m) => m.meal_type))
      const src = (coins.data ?? []).map((x: { src: string }) => x.src)
      setHabitsN((h.data ?? []).length)
      setClaimed(new Set(src.filter((s: string) => s.startsWith('quest:')).map((s: string) => s.slice(6))))
      setCtx({
        p: profile, kcal: sum(meals, (m) => m.kcal), protein: sum(meals, (m) => Number(m.protein_g)), meals: Math.max(types.size, Math.min(3, meals.length)),
        water: sum(water, (x) => x.amount_ml), steps: steps.find((s) => s.day === today)?.steps ?? 0, workouts: wo.length,
        weighed: (w.data ?? []).length > 0, checkin: sl.some((s) => s.night_of === today),
        habitsDone: new Set((hc.data ?? []).map((x: { habit_id: number }) => x.habit_id)).size, habitsTotal: (h.data ?? []).length,
        played: src.includes('game'),
      })
    })
  }, [profile, version, today])

  if (!ctx) return null
  const quests = pick(today, habitsN > 0)
  const doneCount = quests.filter((q) => claimed.has(q.id)).length

  async function claim(q: Quest) {
    try {
      const bal = await earnCoins(`quest:${q.id}`, QUEST_COINS)
      setClaimed(new Set([...claimed, q.id]))
      if (bal == null) return toast('Already claimed today')
      await refreshProfile()
      toast(doneCount + 1 === 3 ? `All quests done! +${QUEST_COINS} 🪙 · Pip is proud 🎉` : `+${QUEST_COINS} 🪙`)
    } catch (e) { toast((e as Error).message) }
  }

  return (
    <section className="card">
      <div className="card-head"><h2>Pip’s quests</h2><span className="small muted">🪙 {profile?.coins ?? 0} · {doneCount}/3 today</span></div>
      <div className="quests">
        {quests.map((q) => {
          const [v, goal] = q.progress(ctx)
          const done = v >= goal, got = claimed.has(q.id)
          return (
            <div key={q.id} className={`quest${got ? ' got' : done ? ' ready' : ''}`}>
              <span className="quest-icon">{q.icon}</span>
              <div className="grow">
                <div className="small"><b>{q.title}</b></div>
                {goal > 1 && !got && <div className="quest-bar"><span style={{ width: `${Math.min(100, (100 * v) / goal)}%` }} /></div>}
              </div>
              {got ? <span className="small muted">✓ +{QUEST_COINS}</span> : done ? <button className="btn sm" onClick={() => claim(q)}>Claim 🪙{QUEST_COINS}</button> : <span className="small muted num">{goal > 1 ? `${Math.min(v, goal).toLocaleString('en-US')}/${goal.toLocaleString('en-US')}` : 'to do'}</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
