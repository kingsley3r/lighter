import { supabase } from './supabase'
import { addDays, isoDate, startOfDay } from './dates'
import type { MealLog, SleepLog, WaterLog, WeightLog, WorkoutLog, WorkoutPlan, MealPlan } from './types'

export function dayRange(d: Date) {
  const from = startOfDay(d)
  const to = addDays(from, 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

export async function mealsBetween(from: string, to: string) {
  const { data } = await supabase.from('meal_logs').select('*').gte('eaten_at', from).lt('eaten_at', to).order('eaten_at')
  return (data ?? []) as MealLog[]
}
export async function waterBetween(from: string, to: string) {
  const { data } = await supabase.from('water_logs').select('*').gte('logged_at', from).lt('logged_at', to).order('logged_at')
  return (data ?? []) as WaterLog[]
}
export async function workoutsBetween(from: string, to: string) {
  const { data } = await supabase.from('workout_logs').select('*').gte('done_at', from).lt('done_at', to).order('done_at')
  return (data ?? []) as WorkoutLog[]
}
export async function weightsSince(fromDate: string) {
  const { data } = await supabase.from('weight_logs').select('*').gte('logged_on', fromDate).order('logged_on')
  return (data ?? []) as WeightLog[]
}
export async function latestWeight() {
  const { data } = await supabase.from('weight_logs').select('*').order('logged_on', { ascending: false }).limit(1).maybeSingle()
  return (data as WeightLog) ?? null
}
export async function sleepSince(fromDate: string) {
  const { data } = await supabase.from('sleep_logs').select('*').gte('night_of', fromDate).order('night_of')
  return (data ?? []) as SleepLog[]
}
export async function activeWorkoutPlan() {
  const { data } = await supabase.from('workout_plans').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data ? ({ id: data.id as number, ...(data.plan as WorkoutPlan) }) : null
}
export async function mealPlanForWeek(weekStart: Date) {
  const { data } = await supabase.from('meal_plans').select('*').eq('week_start', isoDate(weekStart)).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data ? ({ id: data.id as number, ...(data.plan as MealPlan) }) : null
}

export async function addWater(ml: number) {
  return supabase.from('water_logs').insert({ amount_ml: ml })
}
export async function setWeight(dateIso: string, kg: number) {
  return supabase.from('weight_logs').upsert({ logged_on: dateIso, weight_kg: kg }, { onConflict: 'user_id,logged_on' })
}
export async function setSleep(dateIso: string, hours: number, quality: number | null, extra: { mood?: number | null; energy?: number | null } = {}) {
  return supabase.from('sleep_logs').upsert({ night_of: dateIso, hours, quality, ...extra }, { onConflict: 'user_id,night_of' })
}

export function sum<T>(arr: T[], f: (x: T) => number) {
  return arr.reduce((s, x) => s + (Number(f(x)) || 0), 0)
}

export function guessMealType(d = new Date()): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const h = d.getHours()
  if (h < 10.5) return 'breakfast'
  if (h < 14.5) return 'lunch'
  if (h >= 17.5 && h < 21.5) return 'dinner'
  return 'snack'
}

// ---------- Recent foods ----------
export interface RecentFood { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; meal_type: MealLog['meal_type']; count: number; last: string }
export async function recentFoods(limit = 30): Promise<RecentFood[]> {
  const since = addDays(new Date(), -60).toISOString()
  const { data } = await supabase.from('meal_logs').select('name,kcal,protein_g,carbs_g,fat_g,meal_type,eaten_at').gte('eaten_at', since).order('eaten_at', { ascending: false }).limit(400)
  const map = new Map<string, RecentFood>()
  for (const m of (data ?? []) as MealLog[]) {
    const key = m.name.trim().toLowerCase() + '|' + m.kcal
    const cur = map.get(key)
    if (cur) cur.count++
    else map.set(key, { name: m.name, kcal: m.kcal, protein_g: Number(m.protein_g), carbs_g: Number(m.carbs_g), fat_g: Number(m.fat_g), meal_type: m.meal_type, count: 1, last: m.eaten_at })
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, limit)
}

export async function copyMeals(meals: MealLog[], to: Date) {
  const rows = meals.map((m) => {
    const t = new Date(to)
    const src = new Date(m.eaten_at)
    t.setHours(src.getHours(), src.getMinutes(), 0, 0)
    return { name: m.name, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, meal_type: m.meal_type, source: m.source === 'photo' ? 'manual' : m.source, eaten_at: t.toISOString() }
  })
  return supabase.from('meal_logs').insert(rows)
}

// ---------- Streak ----------
export async function loggingStreak(): Promise<number> {
  const since = addDays(new Date(), -120)
  const from = startOfDay(since).toISOString()
  const [m, w, wt] = await Promise.all([
    supabase.from('meal_logs').select('eaten_at').gte('eaten_at', from),
    supabase.from('workout_logs').select('done_at').gte('done_at', from),
    supabase.from('weight_logs').select('logged_on').gte('logged_on', isoDate(since)),
  ])
  const days = new Set<string>()
  for (const r of m.data ?? []) days.add(isoDate(new Date(r.eaten_at)))
  for (const r of w.data ?? []) days.add(isoDate(new Date(r.done_at)))
  for (const r of wt.data ?? []) days.add(r.logged_on)
  let d = new Date()
  if (!days.has(isoDate(d))) d = addDays(d, -1) // today not logged yet doesn't break the streak
  let n = 0
  while (days.has(isoDate(d))) {
    n++
    d = addDays(d, -1)
  }
  return n
}

// ---------- Fasting ----------
export interface Fast { id: number; started_at: string; ended_at: string | null; target_hours: number }
export async function currentFast() {
  const { data } = await supabase.from('fasts').select('*').is('ended_at', null).order('started_at', { ascending: false }).limit(1).maybeSingle()
  return (data as Fast) ?? null
}
export async function lastFasts(n = 7) {
  const { data } = await supabase.from('fasts').select('*').not('ended_at', 'is', null).order('started_at', { ascending: false }).limit(n)
  return (data ?? []) as Fast[]
}

// ---------- Body measurements ----------
export interface Measurement { id: number; measured_on: string; waist_cm: number | null; hips_cm: number | null; chest_cm: number | null; arm_cm: number | null; thigh_cm: number | null; body_fat_pct: number | null; neck_cm?: number | null }
export async function measurementsSince(fromDate: string) {
  const { data } = await supabase.from('body_measurements').select('*').gte('measured_on', fromDate).order('measured_on')
  return (data ?? []) as Measurement[]
}

// ---------- Workout history ----------
export interface SetLog { kg: number | null; reps: number | null }
export interface ExerciseLog { id: string; name: string; done: boolean; sets?: SetLog[] }
export async function lastExerciseSets(): Promise<Record<string, SetLog[]>> {
  const { data } = await supabase.from('workout_logs').select('exercises,done_at').order('done_at', { ascending: false }).limit(40)
  const out: Record<string, SetLog[]> = {}
  for (const w of data ?? []) {
    for (const e of (Array.isArray(w.exercises) ? w.exercises : []) as ExerciseLog[]) {
      if (out[e.id] || !e.sets?.some((s) => s.reps)) continue
      out[e.id] = e.sets
    }
  }
  return out
}
