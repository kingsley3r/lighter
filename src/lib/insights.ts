import { addDays, isoDate } from './dates'
import { mealsBetween, sleepSince, workoutsBetween } from './data'
import type { SleepLog } from './types'

export const MOODS = ['😫', '😕', '😐', '🙂', '😄']
export const ENERGY = ['🪫', '😮‍💨', '😐', '💪', '⚡']

/** `a` is always the tougher group (shown in orange), `b` the better one. */
export interface Insight { icon: string; text: string; a: { label: string; value: number }; b: { label: string; value: number }; unit: string }
export interface Insights { count: number; needed: number; items: Insight[] }

const mean = (x: number[]) => (x.length ? x.reduce((s, v) => s + v, 0) / x.length : null)

/** Compares days by last night's sleep, mood and energy. Needs `needed` check-ins with food logged. */
export async function sleepMoodInsights(sleepTarget = 8, needed = 10): Promise<Insights> {
  const now = new Date()
  const from = addDays(now, -60)
  const [sleep, meals, workouts] = await Promise.all([
    sleepSince(isoDate(from)),
    mealsBetween(from.toISOString(), now.toISOString()),
    workoutsBetween(from.toISOString(), now.toISOString()),
  ])
  const kcal = new Map<string, number>()
  const late = new Map<string, number>() // kcal after 20:00
  for (const m of meals) {
    const d = new Date(m.eaten_at), k = isoDate(d)
    kcal.set(k, (kcal.get(k) ?? 0) + m.kcal)
    if (d.getHours() >= 20) late.set(k, (late.get(k) ?? 0) + m.kcal)
  }
  const trained = new Set(workouts.map((w) => isoDate(new Date(w.done_at))))
  const today = isoDate(now)
  // only finished days with a real amount of food logged
  const days = sleep.filter((s) => s.night_of < today && (kcal.get(s.night_of) ?? 0) > 800)
  const res: Insights = { count: days.length, needed, items: [] }
  if (days.length < needed) return res

  const short = Math.min(7, sleepTarget - 1)
  const split = (f: (s: SleepLog) => boolean | null) => {
    const yes: SleepLog[] = [], no: SleepLog[] = []
    for (const s of days) { const r = f(s); if (r === true) yes.push(s); else if (r === false) no.push(s) }
    return yes.length >= 3 && no.length >= 3 ? [yes, no] as const : null
  }
  const avgK = (xs: SleepLog[]) => Math.round(mean(xs.map((s) => kcal.get(s.night_of) ?? 0)) ?? 0)
  const pctTrain = (xs: SleepLog[]) => Math.round((100 * xs.filter((s) => trained.has(s.night_of)).length) / xs.length)

  const bySleep = split((s) => Number(s.hours) < short)
  if (bySleep) {
    const [bad, good] = bySleep, d = avgK(bad) - avgK(good)
    if (Math.abs(d) >= 100) res.items.push({ icon: '😴', unit: 'kcal', text: d > 0 ? `After nights under ${short} h you eat about ${d} kcal more.` : `Short nights don’t make you eat more. Nice!`, a: { label: `< ${short} h sleep`, value: avgK(bad) }, b: { label: `${short} h +`, value: avgK(good) } })
    const lb = Math.round(mean(bad.map((s) => late.get(s.night_of) ?? 0)) ?? 0), lg = Math.round(mean(good.map((s) => late.get(s.night_of) ?? 0)) ?? 0)
    if (lb - lg >= 80) res.items.push({ icon: '🌙', unit: 'kcal', text: `Tired days bring ~${lb - lg} kcal more late-evening snacking (after 8 pm).`, a: { label: 'tired days', value: lb }, b: { label: 'rested days', value: lg } })
  }
  const byMood = split((s) => (s.mood == null ? null : s.mood <= 2 ? true : s.mood >= 4 ? false : null))
  if (byMood) {
    const [low, high] = byMood, d = avgK(low) - avgK(high)
    if (Math.abs(d) >= 100) res.items.push({ icon: '🙂', unit: 'kcal', text: d > 0 ? `On low-mood days you eat ~${d} kcal more. Plan a go-to comfort meal that fits your target.` : `Low moods don’t push your eating up. That’s a real strength.`, a: { label: 'low mood', value: avgK(low) }, b: { label: 'good mood', value: avgK(high) } })
  }
  const byEnergy = split((s) => (s.energy == null ? null : s.energy >= 4 ? true : s.energy <= 2 ? false : null))
  if (byEnergy) {
    const [hi, lo] = byEnergy, a = pctTrain(hi), b = pctTrain(lo)
    if (Math.abs(a - b) >= 15) res.items.push({ icon: '⚡', unit: '%', text: a > b ? `You train on ${a}% of high-energy days but only ${b}% of low ones. Schedule workouts after good nights.` : `You still train on low-energy days. Great consistency!`, a: { label: 'low energy', value: b }, b: { label: 'high energy', value: a } })
  }
  const withMood = days.filter((s) => s.mood != null)
  if (withMood.length >= needed) {
    const good = withMood.filter((s) => Number(s.hours) >= short), bad = withMood.filter((s) => Number(s.hours) < short)
    const mg = mean(good.map((s) => s.mood!)), mb = mean(bad.map((s) => s.mood!))
    if (good.length >= 3 && bad.length >= 3 && mg != null && mb != null && mg - mb >= 0.5) res.items.push({ icon: '🛏️', unit: '/5', text: `Your mood is ${(mg - mb).toFixed(1)} points better after ${short}+ hours of sleep.`, a: { label: `< ${short} h`, value: Math.round(mb * 10) / 10 }, b: { label: `${short} h +`, value: Math.round(mg * 10) / 10 } })
  }
  return res
}
