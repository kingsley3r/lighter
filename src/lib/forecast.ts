import { addDays, isoDate } from './dates'
import type { WeightLog } from './types'

export interface Forecast { kind: 'eta' | 'reached' | 'flat' | 'gaining' | 'need_data'; date?: Date; perWeek?: number; trend?: number; weeksLeft?: number }

/** Projects the goal date from a straight-line fit of the last 4 weeks of weigh-ins. */
export function forecastGoal(weights: WeightLog[], target: number | null): Forecast {
  if (target == null || weights.length < 5) return { kind: 'need_data' }
  const span = (new Date().getTime() - new Date(weights[0].logged_on).getTime()) / 864e5
  if (span < 10) return { kind: 'need_data' }
  // pace = least-squares slope of the weigh-ins from the last 4 weeks (the smoothed line lags behind)
  const cutoff = isoDate(addDays(new Date(), -28))
  const pts = weights.filter((w) => w.logged_on >= cutoff).map((w) => [new Date(w.logged_on).getTime() / 864e5, Number(w.weight_kg)])
  if (pts.length < 4) return { kind: 'need_data' }
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length
  const den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0)
  if (den === 0) return { kind: 'need_data' }
  const perDay = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / den
  const now = my + perDay * (new Date().getTime() / 864e5 - mx) // fitted weight today
  const perWeek = Math.round(perDay * 7 * 100) / 100
  const wantsLoss = target < now
  if (Math.abs(now - target) < 0.3) return { kind: 'reached', trend: now, perWeek }
  if (Math.abs(perWeek) < 0.05) return { kind: 'flat', trend: now, perWeek }
  if ((wantsLoss && perDay > 0) || (!wantsLoss && perDay < 0)) return { kind: 'gaining', trend: now, perWeek }
  const days = Math.abs((now - target) / perDay)
  if (days > 3 * 365) return { kind: 'flat', trend: now, perWeek }
  return { kind: 'eta', date: addDays(new Date(), Math.round(days)), perWeek, trend: Math.round(now * 10) / 10, weeksLeft: Math.round(days / 7) }
}
