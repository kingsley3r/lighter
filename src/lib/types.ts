export type Sex = 'male' | 'female' | 'other'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Profile {
  id: string
  display_name: string | null
  step_target?: number | null
  pip_outfit?: { hat?: string; gear?: string; bg?: string } | null
  sex: Sex | null
  birth_year: number | null
  height_cm: number | null
  start_weight_kg: number | null
  target_weight_kg: number | null
  activity_level: Activity | null
  weekly_loss_kg: number | null
  diet_tags: string[]
  avoid_foods: string | null
  cook_time_min: number | null
  equipment: string[]
  training_days: number | null
  session_minutes: number | null
  kcal_target: number | null
  protein_target_g: number | null
  water_target_ml: number | null
  sleep_target_h: number | null
  onboarded: boolean
}

export interface WeightLog { id: number; logged_on: string; weight_kg: number }
export interface WaterLog { id: number; logged_at: string; amount_ml: number }
export interface SleepLog { id: number; night_of: string; hours: number; quality: number | null }
export interface MealLog {
  id: number
  eaten_at: string
  meal_type: MealType | null
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  source: 'manual' | 'search' | 'barcode' | 'photo' | 'plan'
  photo_path?: string | null
  notes?: string | null
}
export interface WorkoutLog {
  id: number
  done_at: string
  title: string
  duration_min: number | null
  exercises: unknown
  notes: string | null
  kind?: string | null
  distance_m?: number | null
  elevation_gain_m?: number | null
  kcal?: number | null
  route?: [number, number][] | null
  splits?: number[] | null
  duration_s?: number | null
}

export interface PlannedExercise { id: string; name: string; sets: number; reps: string; cue: string; rest_s: number }
export interface PlannedWorkout { weekday: number; title: string; focus: string; minutes: number; exercises: PlannedExercise[] }
export interface WorkoutPlan { generated_at: string; workouts: PlannedWorkout[] }

export interface Ingredient { item: string; qty: number; unit: string }
export interface PlannedMeal {
  recipe_id: string
  name: string
  emoji: string
  meal_type: MealType
  servings: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  minutes: number
  ingredients: Ingredient[]
  steps: string[]
}
export interface MealPlanDay { date: string; meals: PlannedMeal[] }
export interface MealPlan { kcal_target: number; days: MealPlanDay[]; source: 'templates' | 'ai' }
