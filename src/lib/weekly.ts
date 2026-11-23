import { supabase } from './supabase'
import { addDays, isoDate, startOfWeek } from './dates'
import type { Profile } from './types'

export type GoalKind = 'protein' | 'kcal' | 'workouts' | 'water' | 'weigh' | 'log'
export interface WeeklyGoal { kind: GoalKind; target: number }

export interface DayStat { date: string; kcal: number; protein: number; water: number; meals: number; weighed: boolean; workouts: number }
export interface WeekSummary {
  start: Date
  days: DayStat[]
  weightStart: number | null
  weightEnd: number | null
  counts: Record<GoalKind, number>
  avgKcal: number | null
  bestDay: DayStat | null
}

export const GOAL_TEXT: Record<GoalKind, (n: number) => string> = {
  protein: (n) => `Hit your protein target on ${n} days`,
  kcal: (n) => `Stay within your calories on ${n} days`,
  workouts: (n) => `Finish ${n} workout${n === 1 ? '' : 's'}`,
  water: (n) => `Reach your water goal on ${n} days`,
  weigh: (n) => `Weigh in on ${n} days`,
  log: (n) => `Log your food on ${n} days`,
}
export const GOAL_ICON: Record<GoalKind, string> = { protein: '💪', kcal: '🎯', workouts: '🏋️', water: '💧', weigh: '⚖️', log: '📝' }

/** Gathers one week (Mon–Sun) of logs and counts how often each goal was met. */
export async function weekSummary(start: Date, p: Profile): Promise<WeekSummary> {
  const end = addDays(start, 7)
  const from = start.toISOString(), to = end.toISOString()
  const [m, w, wo, wt] = await Promise.all([
    supabase.from('meal_logs').select('eaten_at,kcal,protein_g').gte('eaten_at', from).lt('eaten_at', to),
    supabase.from('water_logs').select('logged_at,amount_ml').gte('logged_at', from).lt('logged_at', to),
    supabase.from('workout_logs').select('done_at').gte('done_at', from).lt('done_at', to),
    supabase.from('weight_logs').select('logged_on,weight_kg').gte('logged_on', isoDate(addDays(start, -3))).lt('logged_on', isoDate(end)).order('logged_on'),
  ])
  const days: DayStat[] = Array.from({ length: 7 }, (_, i) => ({ date: isoDate(addDays(start, i)), kcal: 0, protein: 0, water: 0, meals: 0, weighed: false, workouts: 0 }))
  const at = (iso: string) => days.find((d) => d.date === isoDate(new Date(iso)))
  for (const r of m.data ?? []) { const d = at(r.eaten_at); if (d) { d.kcal += Number(r.kcal); d.protein += Number(r.protein_g); d.meals++ } }
  for (const r of w.data ?? []) { const d = at(r.logged_at); if (d) d.water += Number(r.amount_ml) }
  for (const r of wo.data ?? []) { const d = at(r.done_at); if (d) d.workouts++ }
  const weights = (wt.data ?? []) as { logged_on: string; weight_kg: number }[]
  for (const r of weights) { const d = days.find((x) => x.date === r.logged_on); if (d) d.weighed = true }
  const inWeek = weights.filter((r) => r.logged_on >= isoDate(start))
  const before = weights.filter((r) => r.logged_on < isoDate(start))
  const kT = p.kcal_target ?? 2000, pT = p.protein_target_g ?? 120, wT = p.water_target_ml ?? 2500
  const logged = days.filter((d) => d.meals > 0)
  const onKcal = (d: DayStat) => d.meals > 0 && d.kcal >= kT * 0.8 && d.kcal <= kT * 1.05
  const counts: Record<GoalKind, number> = {
    protein: days.filter((d) => d.protein >= pT * 0.9).length,
    kcal: days.filter(onKcal).length,
    workouts: days.reduce((a, d) => a + d.workouts, 0),
    water: days.filter((d) => d.water >= wT).length,
    weigh: days.filter((d) => d.weighed).length,
    log: logged.length,
  }
  const score = (d: DayStat) => (onKcal(d) ? 2 : 0) + (d.protein >= pT * 0.9 ? 2 : 0) + (d.water >= wT ? 1 : 0) + (d.workouts ? 1 : 0) - Math.abs(d.kcal - kT) / kT
  const bestDay = logged.length ? [...logged].sort((a, b) => score(b) - score(a))[0] : null
  return {
    start, days, counts, bestDay,
    weightStart: (before.at(-1) ?? inWeek[0])?.weight_kg != null ? Number((before.at(-1) ?? inWeek[0]).weight_kg) : null,
    weightEnd: inWeek.length ? Number(inWeek.at(-1)!.weight_kg) : null,
    avgKcal: logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : null,
  }
}

const CAP: Record<GoalKind, number> = { protein: 7, kcal: 7, workouts: 5, water: 7, weigh: 7, log: 7 }

/** Suggests goals for next week, weakest area first: one small step up from what you did. */
export function suggestGoals(s: WeekSummary, p: Profile): WeeklyGoal[] {
  const c = s.counts
  const plannedWorkouts = Math.max(1, Math.min(5, p.training_days ?? 3))
  const ideal: Record<GoalKind, number> = { log: 7, protein: 5, kcal: 5, water: 5, workouts: plannedWorkouts, weigh: 4 }
  const order: GoalKind[] = (Object.keys(ideal) as GoalKind[]).sort((a, b) => c[a] / ideal[a] - c[b] / ideal[b])
  return order.slice(0, 3).map((k) => ({ kind: k, target: Math.min(CAP[k], Math.max(k === 'workouts' ? 1 : 2, c[k] + (k === 'workouts' ? 1 : 2))) }))
}

export function pipLine(s: WeekSummary, prev: { goal: WeeklyGoal; done: number } | null): string {
  const lost = s.weightStart != null && s.weightEnd != null ? Math.round((s.weightStart - s.weightEnd) * 10) / 10 : null
  if (prev && prev.done >= prev.goal.target) return 'You crushed last week’s goal! I’m so proud of you.'
  if (lost != null && lost >= 0.3) return `Down ${lost} kg this week. Look at us go!`
  if (s.counts.log >= 6) return 'You logged almost every day. That’s how real change happens.'
  if (s.counts.log <= 2) return 'Quiet week? No worries. Let’s start fresh together.'
  return 'Solid week! Let’s make the next one a little better.'
}

export const thisWeek = () => startOfWeek(new Date())

export async function goalFor(weekStart: Date): Promise<WeeklyGoal | null> {
  const { data } = await supabase.from('weekly_goals').select('goal').eq('week_start', isoDate(weekStart)).maybeSingle()
  return (data?.goal as WeeklyGoal) ?? null
}
export async function setGoal(weekStart: Date, goal: WeeklyGoal) {
  return supabase.from('weekly_goals').upsert({ week_start: isoDate(weekStart), goal })
}
