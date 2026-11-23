import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { isoDate } from './dates'

// Food quality, XP, levels and trophies for the Pip buddy.

type M = { name: string; kcal: number; protein_g: number | string; carbs_g: number | string; fat_g: number | string; eaten_at?: string }

const JUNK = /pizza|burger|fries|pommes|chips|crisps|nugget|hot ?dog|kebab|d[öo]ner|mcdonald|mc ?flurry|big mac|burger king|kfc|fried chicken|wings|donut|doughnut|candy|sweets|gumm|chocolate bar|snickers|mars bar|twix|ice cream|cake|cookie|brownie|muffin|croissant|soda|cola|coke|fanta|sprite|energy drink|red bull|milkshake|nachos|currywurst|bratwurst|fast food|takeaway|take-away|frappuccino|waffle|pancakes with syrup|cheesecake|pastry/i
const HEALTHY = /salad|vegetable|veggie|\bveg\b|broccoli|spinach|kale|carrot|cucumber|tomato|zucchini|courgette|asparagus|cauliflower|green beans|peas\b|fruit|apple|banana|berr|orange|kiwi|pear|grape|melon|oat|porridge|skyr|quark|greek yog|cottage|lentil|beans|chickpea|tofu|tempeh|salmon|cod|tuna|fish|shrimp|prawn|chicken breast|grilled chicken|turkey|egg white|boiled egg|omelet|quinoa|brown rice|wholegrain|whole grain|wholemeal|avocado|almond|walnut|edamame|hummus|soup|stir-fry|stir fry|curry with veg|protein shake|cottage cheese/i

export type Quality = 'junk' | 'healthy' | 'ok'
export function quality(m: M): Quality {
  const k = Math.max(1, Number(m.kcal))
  const p = Number(m.protein_g), f = Number(m.fat_g)
  if (JUNK.test(m.name)) return 'junk'
  if (f * 9 / k > 0.55 && k > 550) return 'junk'
  if (HEALTHY.test(m.name)) return 'healthy'
  if (p * 4 / k >= 0.3 && k < 700) return 'healthy'
  return 'ok'
}

export const LEVELS = [0, 100, 300, 600, 1000, 1600, 2400, 3500]
export const TITLES = ['Seedling', 'Sprout', 'Gym Rookie', 'Gym Buddy', 'Athlete', 'Powerlifter', 'Bodybuilder', 'Champion']
export function levelFor(xp: number) {
  let lvl = 1
  LEVELS.forEach((t, i) => { if (xp >= t) lvl = i + 1 })
  const next = LEVELS[lvl] ?? null
  const prev = LEVELS[lvl - 1]
  return { lvl, title: TITLES[lvl - 1], next, toNext: next ? next - xp : 0, progress: next ? (xp - prev) / (next - prev) : 1 }
}

export interface Trophy { id: string; icon: string; title: string; desc: string; value: number; goal: number }

export interface PipStats {
  xp: number
  meals: number
  healthy: number
  junk: number
  workouts: number
  trophies: Trophy[]
}

interface Hist {
  meals: (M & { eaten_at: string })[]
  workouts: { done_at: string; distance_m: number | null }[]
  weights: { logged_on: string; weight_kg: number }[]
}

function maxRun<T>(arr: T[], ok: (x: T) => boolean) {
  let best = 0, cur = 0
  for (const x of arr) { cur = ok(x) ? cur + 1 : 0; best = Math.max(best, cur) }
  return best
}

export function computeStats(h: Hist, kcalTarget: number, proteinTarget: number): PipStats {
  const meals = [...h.meals].sort((a, b) => a.eaten_at.localeCompare(b.eaten_at))
  const q = meals.map(quality)
  const healthy = q.filter((x) => x === 'healthy').length
  const junk = q.filter((x) => x === 'junk').length
  const gym = h.workouts.filter((w) => w.distance_m == null).length
  const gps = h.workouts.filter((w) => w.distance_m != null)
  const km = gps.reduce((a, w) => a + Number(w.distance_m), 0) / 1000

  // per-day aggregates (local dates)
  const days = new Map<string, { kcal: number; p: number; junk: number }>()
  meals.forEach((m, i) => {
    const d = isoDate(new Date(m.eaten_at))
    const cur = days.get(d) ?? { kcal: 0, p: 0, junk: 0 }
    cur.kcal += Number(m.kcal); cur.p += Number(m.protein_g); if (q[i] === 'junk') cur.junk++
    days.set(d, cur)
  })
  const today = isoDate()
  const dayKeys = [...days.keys()].sort()
  // consecutive-day runs
  let bestStreak = 0, run = 0, prev: Date | null = null
  for (const k of dayKeys) {
    const d = new Date(k + 'T12:00:00')
    run = prev && Math.round((d.getTime() - prev.getTime()) / 864e5) === 1 ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
    prev = d
  }
  const past = dayKeys.filter((k) => k !== today).map((k) => days.get(k)!)
  const proteinDays = [...days.values()].filter((d) => d.p >= proteinTarget).length
  const targetDays = past.filter((d) => d.kcal >= kcalTarget * 0.9 && d.kcal <= kcalTarget * 1.1).length
  const noJunkRun = maxRun(dayKeys.map((k) => days.get(k)!), (d) => d.junk === 0)
  const cleanRun = maxRun(q, (x) => x === 'healthy')
  const w = [...h.weights].sort((a, b) => a.logged_on.localeCompare(b.logged_on))
  const lost = w.length > 1 ? Math.max(0, Number(w[0].weight_kg) - Number(w[w.length - 1].weight_kg)) : 0

  const xp = Math.max(0, meals.length * 10 + healthy * 6 - junk * 4 + gym * 25 + gps.length * 20 + proteinDays * 10)
  const { lvl } = levelFor(xp)

  const T = (id: string, icon: string, title: string, desc: string, value: number, goal: number): Trophy => ({ id, icon, title, desc, value: Math.min(value, goal), goal })
  const trophies = [
    T('first_bite', '🍽️', 'First bite', 'Log your first meal', meals.length, 1),
    T('meals_50', '🥄', 'Regular', 'Log 50 meals', meals.length, 50),
    T('meals_200', '🍱', 'Logging pro', 'Log 200 meals', meals.length, 200),
    T('streak_3', '🔥', 'On a roll', 'Log food 3 days in a row', bestStreak, 3),
    T('streak_7', '📆', 'Week warrior', 'Log food 7 days in a row', bestStreak, 7),
    T('streak_30', '🌋', 'Unstoppable', 'Log food 30 days in a row', bestStreak, 30),
    T('protein_1', '💪', 'Protein day', 'Hit your protein target', proteinDays, 1),
    T('protein_10', '🥩', 'Protein machine', 'Hit protein on 10 days', proteinDays, 10),
    T('target_5', '🎯', 'Bullseye', '5 days within ±10% of your calories', targetDays, 5),
    T('clean_5', '🥦', 'Clean streak', '5 healthy meals in a row', cleanRun, 5),
    T('clean_50', '🥗', 'Green machine', 'Eat 50 healthy meals', healthy, 50),
    T('nojunk_7', '🚫', 'Junk-free week', '7 logged days in a row without fast food', noJunkRun, 7),
    T('workout_1', '🏋️', 'First sweat', 'Finish a workout', gym, 1),
    T('workout_25', '🏆', 'Iron regular', 'Finish 25 workouts', gym, 25),
    T('gps_1', '👟', 'Out the door', 'Track a run, walk or ride', gps.length, 1),
    T('km_50', '🗺️', 'Explorer', 'Track 50 km in total', Math.floor(km), 50),
    T('kg_1', '⚖️', 'First kilo down', 'Lose 1 kg', Math.floor(lost * 10) / 10, 1),
    T('kg_5', '🎉', 'Five down', 'Lose 5 kg', Math.floor(lost * 10) / 10, 5),
    T('pip_5', '🌱', 'Athlete Pip', 'Grow Pip to level 5', lvl, 5),
    T('pip_8', '🏅', 'Champion', 'Grow Pip to level 8', lvl, 8),
  ]
  return { xp, meals: meals.length, healthy, junk, workouts: gym + gps.length, trophies }
}

export function usePipStats(version: number, kcalTarget: number, proteinTarget: number) {
  const [stats, setStats] = useState<PipStats | null>(null)
  useEffect(() => {
    let live = true
    const since = new Date(Date.now() - 400 * 864e5).toISOString()
    Promise.all([
      supabase.from('meal_logs').select('name,kcal,protein_g,carbs_g,fat_g,eaten_at').gte('eaten_at', since).order('eaten_at', { ascending: false }).limit(3000),
      supabase.from('workout_logs').select('done_at,distance_m').gte('done_at', since).limit(2000),
      supabase.from('weight_logs').select('logged_on,weight_kg').order('logged_on').limit(2000),
    ]).then(([m, w, wt]) => {
      if (!live) return
      setStats(computeStats({ meals: (m.data ?? []) as Hist['meals'], workouts: (w.data ?? []) as Hist['workouts'], weights: (wt.data ?? []) as Hist['weights'] }, kcalTarget, proteinTarget))
    })
    return () => { live = false }
  }, [version, kcalTarget, proteinTarget])
  return stats
}

/** Returns trophies unlocked since the last time this was called, and remembers them. */
export function newlyUnlocked(trophies: Trophy[]): Trophy[] {
  const done = trophies.filter((t) => t.value >= t.goal)
  let seen: string[] | null = null
  try { seen = JSON.parse(localStorage.getItem('trophies-seen') || 'null') } catch { /* ignore */ }
  try { localStorage.setItem('trophies-seen', JSON.stringify(done.map((t) => t.id))) } catch { /* ignore */ }
  if (!seen) return [] // first run: don't flood with old achievements
  return done.filter((t) => !seen!.includes(t.id))
}
