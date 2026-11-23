import { addDays, isoDate, startOfDay } from './dates'
import { mealsBetween, sleepSince, weightsSince, workoutsBetween } from './data'
import { stepsSince } from './steps'
import { trendSeries } from './trend'
import type { Profile } from './types'

export type FixId = 'logging' | 'over' | 'weekend' | 'steps' | 'strength' | 'sleep' | 'refeed' | 'target'
export interface Fix { id: FixId; icon: string; title: string; why: string; action?: { label: string; kind: 'steps' | 'kcal' | 'train' | 'refeed'; value?: number } }
export interface Plateau { stalled: boolean; change14: number; days: number; fixes: Fix[]; tdee: number | null }

/** Looks at the last 14 days: is the weight trend flat while the goal is to lose? If so, find likely reasons. */
export async function checkPlateau(p: Profile): Promise<Plateau | null> {
  const now = new Date()
  const d14 = startOfDay(addDays(now, -14))
  const [weights, meals, steps, workouts, sleep] = await Promise.all([
    weightsSince(isoDate(addDays(now, -90))),
    mealsBetween(d14.toISOString(), startOfDay(now).toISOString()),
    stepsSince(isoDate(d14)),
    workoutsBetween(d14.toISOString(), now.toISOString()),
    sleepSince(isoDate(d14)),
  ])
  if (weights.length < 6) return null
  const first = weights[0].logged_on
  if (first > isoDate(addDays(now, -21))) return null // need 3 weeks of history
  const recent = weights.filter((w) => w.logged_on >= isoDate(d14))
  if (recent.length < 4) return null
  const t = trendSeries(weights)
  const a = t.get(isoDate(d14)), b = t.get(isoDate(addDays(now, -1))) ?? t.get(isoDate(now))
  if (a == null || b == null) return null
  const change14 = Math.round((b - a) * 100) / 100
  const wantsLoss = p.target_weight_kg != null && b > Number(p.target_weight_kg) + 0.5
  const stalled = wantsLoss && change14 > -0.25

  // per-day intake
  const kT = p.kcal_target ?? 2000
  const days = new Map<string, number>()
  for (const m of meals) { const k = isoDate(new Date(m.eaten_at)); days.set(k, (days.get(k) ?? 0) + m.kcal) }
  const full = [...days.entries()].filter(([, v]) => v > 800)
  const avg = full.length ? full.reduce((s, [, v]) => s + v, 0) / full.length : null
  const wkend = full.filter(([k]) => [0, 6].includes(new Date(k + 'T12:00').getDay())).map(([, v]) => v)
  const wkday = full.filter(([k]) => ![0, 6].includes(new Date(k + 'T12:00').getDay())).map(([, v]) => v)
  const mean = (x: number[]) => (x.length ? x.reduce((s, v) => s + v, 0) / x.length : null)
  const stepAvg = steps.length ? steps.reduce((s, x) => s + x.steps, 0) / steps.length : null
  const gym = workouts.filter((w) => w.distance_m == null).length
  const sleepAvg = sleep.length ? sleep.reduce((s, x) => s + Number(x.hours), 0) / sleep.length : null
  const tdee = avg != null ? Math.round((avg - (change14 * 7700) / 14) / 10) * 10 : null
  const dietWeeks = Math.round((now.getTime() - new Date(first).getTime()) / (7 * 864e5))

  const fixes: Fix[] = []
  if (full.length < 10) fixes.push({ id: 'logging', icon: '📝', title: 'Log every day for 2 weeks', why: `Only ${full.length} of the last 14 days are fully logged. Unlogged snacks, drinks and cooking oil are the most common reason the scale stops.` })
  if (avg != null && avg > kT * 1.05) fixes.push({ id: 'over', icon: '🎯', title: 'Get back to your target', why: `You averaged ${Math.round(avg)} kcal, about ${Math.round(avg - kT)} above your ${kT} target.` })
  const we = mean(wkend), wd = mean(wkday)
  if (we != null && wd != null && we - wd > 350) fixes.push({ id: 'weekend', icon: '🍕', title: 'Tame the weekends', why: `Weekends are ~${Math.round(we - wd)} kcal higher than weekdays. Two big days can cancel a whole week.` })
  if (stepAvg == null || stepAvg < 7000) {
    const goal = Math.min(12000, Math.max(7000, Math.round(((stepAvg ?? 5000) + 2000) / 500) * 500))
    fixes.push({ id: 'steps', icon: '👣', title: `Walk ${goal.toLocaleString('en-US')} steps a day`, why: stepAvg == null ? 'No steps logged. Daily walking is the easiest way to burn 150–300 kcal more without feeling hungrier.' : `You averaged ${Math.round(stepAvg).toLocaleString('en-US')} steps. 2,000 more burns ~80–100 kcal a day.`, action: { label: `Set goal to ${goal.toLocaleString('en-US')}`, kind: 'steps', value: goal } })
  }
  if (gym < 3) fixes.push({ id: 'strength', icon: '🏋️', title: 'Add strength training', why: `${gym} strength session${gym === 1 ? '' : 's'} in 2 weeks. Lifting keeps muscle while dieting and a new program gives your body a fresh challenge.`, action: { label: 'Pick a program', kind: 'train' } })
  if (sleepAvg != null && sleepAvg < 6.5) fixes.push({ id: 'sleep', icon: '😴', title: 'Sleep at least 7 hours', why: `You averaged ${sleepAvg.toFixed(1)} h. Short sleep raises hunger hormones and water retention.` })
  if (dietWeeks >= 8 && full.length >= 10 && (avg == null || avg <= kT * 1.05)) fixes.push({ id: 'refeed', icon: '🍝', title: 'Try a refeed day', why: `After ${dietWeeks} weeks of dieting, one day at maintenance (~${tdee ?? kT + 400} kcal, extra carbs) can lower stress and water retention. The scale often drops 1–3 days later.`, action: { label: 'Plan it for tomorrow', kind: 'refeed', value: tdee ?? kT + 400 } })
  if (full.length >= 10 && avg != null && avg <= kT * 1.05 && tdee != null && tdee - kT < 250) {
    const next = Math.max(p.sex === 'female' ? 1300 : 1500, kT - 150)
    if (next < kT) fixes.push({ id: 'target', icon: '⬇️', title: `Lower your target to ${next} kcal`, why: `Your data says you burn about ${tdee} kcal a day, so ${kT} leaves almost no deficit.`, action: { label: `Set ${next} kcal`, kind: 'kcal', value: next } })
  }
  return { stalled, change14, days: 14, fixes: fixes.slice(0, 4), tdee }
}
