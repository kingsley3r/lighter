import type { Activity, Profile, Sex } from './types'

export const ACTIVITY: Record<Activity, { label: string; hint: string; factor: number }> = {
  sedentary: { label: 'Mostly sitting', hint: 'Desk job, little walking', factor: 1.2 },
  light: { label: 'Lightly active', hint: 'Some walking, on feet now and then', factor: 1.375 },
  moderate: { label: 'Moderately active', hint: 'On your feet a lot, or active commute', factor: 1.55 },
  active: { label: 'Very active', hint: 'Physical job or lots of daily movement', factor: 1.725 },
  very_active: { label: 'Extremely active', hint: 'Hard physical work all day', factor: 1.9 },
}

export function age(birthYear: number | null): number {
  if (!birthYear) return 30
  return new Date().getFullYear() - birthYear
}

export function bmr(sex: Sex | null, weightKg: number, heightCm: number, ageY: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageY
  if (sex === 'male') return base + 5
  if (sex === 'female') return base - 161
  return base - 78
}

export interface Targets { kcal: number; protein: number; tdee: number; deficit: number }

export function computeTargets(p: Partial<Profile>, currentWeight?: number | null): Targets {
  const w = Number(currentWeight ?? p.start_weight_kg ?? 80)
  const h = Number(p.height_cm ?? 175)
  const a = age(p.birth_year ?? null)
  const factor = ACTIVITY[(p.activity_level ?? 'light') as Activity].factor
  const tdee = bmr(p.sex ?? null, w, h, a) * factor
  const wantDeficit = (Number(p.weekly_loss_kg ?? 0.5) * 7700) / 7
  const floor = p.sex === 'female' ? 1200 : 1500
  const kcal = Math.max(floor, Math.round((tdee - wantDeficit) / 10) * 10)
  const protein = Math.round(1.8 * Number(p.target_weight_kg ?? w))
  return { kcal, protein, tdee: Math.round(tdee), deficit: Math.round(tdee - kcal) }
}

export function macroTargets(kcal: number, protein: number) {
  const fat = Math.round((kcal * 0.28) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { protein, fat, carbs }
}

export function bmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100
  return weightKg / (m * m)
}

export const round1 = (n: number) => Math.round(n * 10) / 10
