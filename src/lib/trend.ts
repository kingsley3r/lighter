import type { WeightLog } from './types'
import { addDays, isoDate, parseDate } from './dates'

/** Exponentially smoothed weight per calendar day (gaps carried forward). */
export function trendSeries(weights: WeightLog[], alpha = 0.1): Map<string, number> {
  const out = new Map<string, number>()
  if (!weights.length) return out
  const byDay = new Map(weights.map((w) => [w.logged_on, Number(w.weight_kg)]))
  let d = parseDate(weights[0].logged_on)
  const end = new Date()
  let t = Number(weights[0].weight_kg)
  while (d <= end) {
    const k = isoDate(d)
    const v = byDay.get(k)
    if (v != null) t = t + alpha * (v - t)
    out.set(k, Math.round(t * 100) / 100)
    d = addDays(d, 1)
  }
  return out
}

export interface Expenditure { tdee: number; days: number; loggedDays: number; avgIntake: number; weeklyChange: number }

/**
 * Estimate real daily energy expenditure from logged intake and the weight trend
 * (energy balance: 1 kg ≈ 7700 kcal). Needs ~2 weeks of data.
 */
export function estimateExpenditure(dailyKcal: Map<string, number>, trend: Map<string, number>, windowDays = 21): Expenditure | null {
  const today = new Date()
  const start = addDays(today, -windowDays)
  const end = addDays(today, -1)
  const t0 = trend.get(isoDate(start))
  const t1 = trend.get(isoDate(end))
  if (t0 == null || t1 == null) return null
  const kcals: number[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const v = dailyKcal.get(isoDate(d))
    if (v != null && v > 600) kcals.push(v) // skip obviously incomplete days
  }
  if (kcals.length < 10) return null
  const avgIntake = kcals.reduce((a, b) => a + b, 0) / kcals.length
  const days = windowDays - 1
  const change = t1 - t0
  const tdee = avgIntake - (change * 7700) / days
  return { tdee: Math.round(tdee / 10) * 10, days, loggedDays: kcals.length, avgIntake: Math.round(avgIntake), weeklyChange: Math.round((change / days) * 7 * 100) / 100 }
}
