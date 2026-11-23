import { supabase } from './supabase'
import { isoDate } from './dates'

export interface StepLog { day: string; steps: number; source: string; updated_at: string }

export async function stepsSince(fromDate: string) {
  const { data } = await supabase.from('step_logs').select('day,steps,source,updated_at').gte('day', fromDate).order('day')
  return (data ?? []) as StepLog[]
}
export async function stepsOn(day = isoDate()) {
  const { data } = await supabase.from('step_logs').select('day,steps,source,updated_at').eq('day', day).maybeSingle()
  return (data as StepLog) ?? null
}
export async function setSteps(day: string, steps: number) {
  return supabase.from('step_logs').upsert({ day, steps, source: 'manual', updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' })
}
/** Rough calories burned by walking: ~0.04 kcal per step per 80 kg. */
export const stepKcal = (steps: number, kg = 80) => Math.round(steps * 0.04 * (kg / 80))
