import type { Ingredient, MealPlan, MealPlanDay, MealType, PlannedMeal } from '../lib/types'
import { addDays, isoDate } from '../lib/dates'

export const DIET_TAGS: { id: string; label: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'pescatarian', label: 'Pescatarian' },
  { id: 'no_pork', label: 'No pork' },
  { id: 'gluten_free', label: 'Gluten-free' },
  { id: 'lactose_free', label: 'Lactose-free' },
  { id: 'nut_free', label: 'Nut-free' },
]

type Kind = 'breakfast' | 'main' | 'snack'

export interface Recipe {
  id: string
  name: string
  emoji: string
  kind: Kind
  minutes: number
  kcal: number
  p: number
  c: number
  f: number
  ok: string[]
  ing: Ingredient[]
  steps: string[]
}

const VEG = ['vegetarian', 'pescatarian', 'no_pork']
const VEGAN = ['vegan', ...VEG]
const FISH = ['pescatarian', 'no_pork']
const GF = 'gluten_free'
const LF = 'lactose_free'
const NF = 'nut_free'

const i = (item: string, qty: number, unit: string): Ingredient => ({ item, qty, unit })
const R = (id: string, name: string, emoji: string, kind: Kind, minutes: number, macros: [number, number, number, number], ok: string[], ing: Ingredient[], steps: string[]): Recipe => ({ id, name, emoji, kind, minutes, kcal: macros[0], p: macros[1], c: macros[2], f: macros[3], ok, ing, steps })

export const RECIPES: Recipe[] = [
  R('overnight_oats', 'Protein overnight oats', '🥣', 'breakfast', 5, [390, 28, 50, 8], [...VEG, NF], [i('Rolled oats', 50, 'g'), i('Skyr / Greek yogurt (0.2%)', 150, 'g'), i('Milk', 100, 'ml'), i('Frozen berries', 80, 'g'), i('Chia seeds', 5, 'g')], ['Mix oats, yogurt, milk and chia in a jar.', 'Top with berries, close and refrigerate overnight.']),
  R('veggie_omelette', 'Veggie omelette + toast', '🍳', 'breakfast', 10, [380, 26, 28, 17], [...VEG, NF, LF], [i('Eggs', 3, 'pcs'), i('Spinach', 40, 'g'), i('Cherry tomatoes', 80, 'g'), i('Wholegrain bread', 1, 'slice'), i('Olive oil', 3, 'ml')], ['Whisk eggs with salt and pepper.', 'Wilt spinach and tomatoes in a lightly oiled pan.', 'Pour in eggs, cook on low until set. Serve with toast.']),
  R('skyr_bowl', 'Skyr bowl with fruit', '🫐', 'breakfast', 3, [320, 30, 40, 4], [...VEG, GF, NF], [i('Skyr', 250, 'g'), i('Banana', 1, 'pcs'), i('Frozen berries', 60, 'g'), i('Honey', 5, 'g')], ['Spoon skyr into a bowl.', 'Top with sliced banana, berries and a drizzle of honey.']),
  R('tofu_scramble', 'Tofu scramble wrap', '🌯', 'breakfast', 12, [400, 25, 38, 16], [...VEGAN, LF, NF], [i('Firm tofu', 150, 'g'), i('Wholegrain tortilla', 1, 'pcs'), i('Bell pepper', 0.5, 'pcs'), i('Turmeric', 1, 'tsp'), i('Olive oil', 5, 'ml')], ['Crumble tofu into a hot oiled pan with diced pepper.', 'Season with turmeric, salt, pepper; cook 5 min.', 'Fill the warm tortilla and roll.']),
  R('cottage_toast', 'Cottage cheese & tomato toast', '🍞', 'breakfast', 5, [340, 24, 36, 9], [...VEG, NF], [i('Wholegrain bread', 2, 'slice'), i('Cottage cheese', 150, 'g'), i('Tomato', 1, 'pcs'), i('Chives', 1, 'tbsp')], ['Toast the bread.', 'Spread cottage cheese, top with tomato slices, chives, salt and pepper.']),
  R('egg_muffins', 'Egg muffins (meal prep)', '🧁', 'breakfast', 25, [300, 24, 6, 19], [...VEG, GF, NF], [i('Eggs', 3, 'pcs'), i('Feta', 30, 'g'), i('Bell pepper', 0.5, 'pcs'), i('Spinach', 30, 'g')], ['Whisk eggs, stir in chopped veg and feta.', 'Pour into a muffin tray, bake 20 min at 180 °C.', 'Keeps 4 days in the fridge.']),

  R('chicken_rice_bowl', 'Chicken, rice & veg bowl', '🍗', 'main', 25, [560, 45, 62, 12], ['no_pork', GF, LF, NF], [i('Chicken breast', 150, 'g'), i('Rice (dry)', 70, 'g'), i('Broccoli', 150, 'g'), i('Soy sauce', 1, 'tbsp'), i('Olive oil', 5, 'ml')], ['Cook rice.', 'Slice chicken, fry in oil 6–8 min until cooked through.', 'Steam broccoli 5 min. Combine and season with soy sauce.']),
  R('turkey_chili', 'Turkey chili', '🌶️', 'main', 30, [520, 42, 50, 13], ['no_pork', GF, LF, NF], [i('Turkey mince', 150, 'g'), i('Kidney beans (can)', 120, 'g'), i('Chopped tomatoes (can)', 200, 'g'), i('Onion', 0.5, 'pcs'), i('Chili spice', 1, 'tsp')], ['Brown onion and mince.', 'Add tomatoes, beans and spices; simmer 20 min.', 'Makes great leftovers.']),
  R('salmon_potatoes', 'Oven salmon, potatoes & green beans', '🐟', 'main', 30, [580, 38, 45, 25], [...FISH, GF, LF, NF], [i('Salmon fillet', 130, 'g'), i('Potatoes', 250, 'g'), i('Green beans', 150, 'g'), i('Lemon', 0.5, 'pcs'), i('Olive oil', 5, 'ml')], ['Cut potatoes into wedges, toss with oil, bake 15 min at 200 °C.', 'Add salmon and beans to the tray, bake 12–15 min more.', 'Finish with lemon juice.']),
  R('lentil_curry', 'Red lentil curry', '🍛', 'main', 25, [520, 24, 78, 11], [...VEGAN, GF, LF, NF], [i('Red lentils (dry)', 80, 'g'), i('Light coconut milk', 100, 'ml'), i('Chopped tomatoes (can)', 150, 'g'), i('Spinach', 60, 'g'), i('Curry paste', 1, 'tbsp'), i('Rice (dry)', 40, 'g')], ['Fry curry paste 1 min.', 'Add lentils, tomatoes, coconut milk and 200 ml water; simmer 15 min.', 'Stir in spinach. Serve with rice.']),
  R('beef_stirfry', 'Beef & veg stir-fry with noodles', '🥢', 'main', 20, [580, 40, 60, 18], ['no_pork', LF, NF], [i('Lean beef strips', 130, 'g'), i('Egg noodles (dry)', 60, 'g'), i('Stir-fry vegetables', 200, 'g'), i('Soy sauce', 1, 'tbsp'), i('Garlic', 1, 'clove')], ['Cook noodles.', 'Sear beef on high heat 2 min, remove.', 'Stir-fry vegetables and garlic, add beef, noodles and soy sauce.']),
  R('chickpea_salad', 'Chickpea, feta & cucumber salad', '🥗', 'main', 10, [480, 22, 45, 22], [...VEG, GF, NF], [i('Chickpeas (can)', 150, 'g'), i('Feta', 50, 'g'), i('Cucumber', 0.5, 'pcs'), i('Cherry tomatoes', 100, 'g'), i('Olive oil', 10, 'ml'), i('Red onion', 0.25, 'pcs')], ['Rinse chickpeas.', 'Chop vegetables, crumble feta, combine.', 'Dress with oil, lemon or vinegar, salt and pepper.']),
  R('tuna_pasta', 'Tuna tomato pasta', '🍝', 'main', 15, [540, 38, 72, 9], [...FISH, LF, NF], [i('Wholegrain pasta (dry)', 80, 'g'), i('Tuna in water (can)', 1, 'can'), i('Passata', 150, 'g'), i('Garlic', 1, 'clove'), i('Capers', 1, 'tbsp')], ['Cook pasta.', 'Warm passata with garlic and capers, stir in tuna.', 'Toss with pasta.']),
  R('chicken_wrap', 'Chicken & yogurt-sauce wrap', '🌯', 'main', 15, [500, 42, 45, 14], ['no_pork', NF], [i('Chicken breast', 130, 'g'), i('Wholegrain tortilla', 1, 'pcs'), i('Greek yogurt', 50, 'g'), i('Lettuce', 40, 'g'), i('Tomato', 1, 'pcs'), i('Paprika', 1, 'tsp')], ['Season chicken with paprika, fry and slice.', 'Mix yogurt with garlic, salt, lemon.', 'Fill tortilla with lettuce, tomato, chicken and sauce.']),
  R('shakshuka', 'Shakshuka with bread', '🍅', 'main', 20, [450, 24, 40, 21], [...VEG, LF, NF], [i('Eggs', 3, 'pcs'), i('Chopped tomatoes (can)', 200, 'g'), i('Bell pepper', 1, 'pcs'), i('Onion', 0.5, 'pcs'), i('Cumin', 1, 'tsp'), i('Wholegrain bread', 1, 'slice')], ['Soften onion and pepper.', 'Add tomatoes and cumin, simmer 8 min.', 'Make wells, crack in eggs, cover until set.']),
  R('tofu_veg_rice', 'Crispy tofu & veg rice', '🍚', 'main', 25, [530, 28, 62, 18], [...VEGAN, LF, NF], [i('Firm tofu', 180, 'g'), i('Rice (dry)', 70, 'g'), i('Frozen peas & carrots', 150, 'g'), i('Soy sauce', 1, 'tbsp'), i('Cornstarch', 1, 'tbsp')], ['Cube tofu, toss in cornstarch, pan-fry until crisp.', 'Cook rice and veg.', 'Combine with soy sauce.']),
  R('cod_veg_tray', 'Cod with Mediterranean tray veg', '🐠', 'main', 30, [430, 36, 35, 14], [...FISH, GF, LF, NF], [i('Cod fillet', 160, 'g'), i('Zucchini', 1, 'pcs'), i('Bell pepper', 1, 'pcs'), i('Red onion', 0.5, 'pcs'), i('Potatoes', 150, 'g'), i('Olive oil', 8, 'ml')], ['Chop vegetables, toss with oil, roast 15 min at 200 °C.', 'Add cod, roast 10–12 min more.']),
  R('bean_burrito_bowl', 'Black bean burrito bowl', '🌮', 'main', 20, [540, 22, 85, 11], [...VEGAN, GF, LF, NF], [i('Black beans (can)', 150, 'g'), i('Rice (dry)', 60, 'g'), i('Sweetcorn', 60, 'g'), i('Salsa', 60, 'g'), i('Avocado', 0.25, 'pcs')], ['Cook rice.', 'Warm beans with cumin and paprika.', 'Assemble with corn, salsa and avocado.']),
  R('chicken_soup', 'Chicken vegetable soup', '🍲', 'main', 35, [380, 36, 30, 10], ['no_pork', GF, LF, NF], [i('Chicken breast', 130, 'g'), i('Carrots', 2, 'pcs'), i('Celery', 1, 'stalk'), i('Potatoes', 120, 'g'), i('Stock cube', 1, 'pcs')], ['Simmer diced chicken and vegetables in 600 ml stock for 25 min.', 'Season and serve. Freezes well.']),
  R('egg_fried_rice', 'Egg fried rice with veg', '🥚', 'main', 15, [480, 22, 62, 15], [...VEG, LF, NF], [i('Cooked rice', 200, 'g'), i('Eggs', 2, 'pcs'), i('Frozen peas & carrots', 120, 'g'), i('Spring onion', 2, 'pcs'), i('Soy sauce', 1, 'tbsp')], ['Scramble eggs in a hot pan, set aside.', 'Fry veg and rice 4 min.', 'Add eggs, soy sauce and spring onion.']),

  R('apple_pb', 'Apple + peanut butter', '🍎', 'snack', 2, [190, 5, 22, 9], [...VEGAN, GF, LF], [i('Apple', 1, 'pcs'), i('Peanut butter', 15, 'g')], ['Slice apple, dip.']),
  R('skyr_snack', 'Skyr with cinnamon', '🥄', 'snack', 1, [130, 20, 10, 0], [...VEG, GF, NF], [i('Skyr', 200, 'g'), i('Cinnamon', 1, 'pinch')], ['Stir cinnamon into skyr.']),
  R('boiled_eggs', '2 boiled eggs', '🥚', 'snack', 10, [150, 13, 1, 10], [...VEG, GF, LF, NF], [i('Eggs', 2, 'pcs')], ['Boil 8 min, cool in cold water.']),
  R('hummus_veg', 'Hummus & veggie sticks', '🥕', 'snack', 5, [170, 6, 16, 9], [...VEGAN, GF, LF, NF], [i('Hummus', 60, 'g'), i('Carrots', 1, 'pcs'), i('Cucumber', 0.25, 'pcs')], ['Cut veggies into sticks, dip.']),
  R('edamame', 'Edamame with sea salt', '🫘', 'snack', 5, [150, 13, 9, 6], [...VEGAN, GF, LF, NF], [i('Frozen edamame', 120, 'g')], ['Boil 4 min, salt.']),
  R('cottage_berries', 'Cottage cheese & berries', '🍓', 'snack', 2, [160, 18, 12, 4], [...VEG, GF, NF], [i('Cottage cheese', 150, 'g'), i('Frozen berries', 60, 'g')], ['Combine in a bowl.']),
]

export function recipeAllowed(r: Recipe, tags: string[], avoid: string, maxMinutes: number) {
  for (const t of tags) if (!r.ok.includes(t)) return false
  const words = avoid
    .toLowerCase()
    .split(/[,;\n]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2)
  if (words.length) {
    const hay = (r.name + ' ' + r.ing.map((x) => x.item).join(' ')).toLowerCase()
    if (words.some((w) => hay.includes(w))) return false
  }
  if (maxMinutes && r.minutes > maxMinutes + 10) return false
  return true
}

function toPlanned(r: Recipe, type: MealType, servings: number): PlannedMeal {
  const s = Math.round(servings * 4) / 4
  return {
    recipe_id: r.id,
    name: r.name,
    emoji: r.emoji,
    meal_type: type,
    servings: s,
    kcal: Math.round(r.kcal * s),
    protein_g: Math.round(r.p * s),
    carbs_g: Math.round(r.c * s),
    fat_g: Math.round(r.f * s),
    minutes: r.minutes,
    ingredients: r.ing.map((x) => ({ ...x, qty: Math.round(x.qty * s * 100) / 100 })),
    steps: r.steps,
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1))
    ;[a[k], a[j]] = [a[j], a[k]]
  }
  return a
}

export function generateMealPlan(opts: { kcal: number; tags: string[]; avoid: string; cookMinutes: number; start: Date; days?: number }): MealPlan {
  const pool = RECIPES.filter((r) => recipeAllowed(r, opts.tags, opts.avoid, opts.cookMinutes))
  const fallback = RECIPES.filter((r) => recipeAllowed(r, opts.tags, opts.avoid, 0))
  const by = (k: Kind) => {
    const p = pool.filter((r) => r.kind === k)
    return shuffle(p.length ? p : fallback.filter((r) => r.kind === k))
  }
  const bf = by('breakfast')
  const mains = by('main')
  const snacks = by('snack')
  const days: MealPlanDay[] = []
  const n = opts.days ?? 7
  for (let d = 0; d < n; d++) {
    const picks: { r: Recipe; t: MealType }[] = []
    if (bf.length) picks.push({ r: bf[d % bf.length], t: 'breakfast' })
    if (mains.length) picks.push({ r: mains[(d * 2) % mains.length], t: 'lunch' })
    if (mains.length) picks.push({ r: mains[(d * 2 + 1) % mains.length], t: 'dinner' })
    if (snacks.length) picks.push({ r: snacks[d % snacks.length], t: 'snack' })
    const base = picks.reduce((s, x) => s + x.r.kcal, 0) || 1
    const factor = Math.min(1.75, Math.max(0.75, opts.kcal / base))
    days.push({
      date: isoDate(addDays(opts.start, d)),
      meals: picks.map(({ r, t }) => toPlanned(r, t, t === 'snack' ? Math.min(1.5, Math.max(1, factor)) : factor)),
    })
  }
  return { kcal_target: opts.kcal, days, source: 'templates' }
}

export function shoppingList(plan: MealPlan): Ingredient[] {
  const map = new Map<string, Ingredient>()
  for (const d of plan.days)
    for (const m of d.meals)
      for (const ing of m.ingredients) {
        const key = ing.item.toLowerCase() + '|' + ing.unit
        const cur = map.get(key)
        if (cur) cur.qty += ing.qty
        else map.set(key, { ...ing })
      }
  return [...map.values()]
    .map((x) => ({ ...x, qty: x.unit === 'g' || x.unit === 'ml' ? Math.ceil(x.qty / 10) * 10 : Math.ceil(x.qty * 4) / 4 }))
    .sort((a, b) => a.item.localeCompare(b.item))
}

const EXTRA_AVOID = ['Mushrooms', 'Fish', 'Seafood', 'Shrimp', 'Pork', 'Beef', 'Lamb', 'Eggs', 'Milk', 'Cheese', 'Nuts', 'Peanuts', 'Gluten', 'Soy', 'Tofu', 'Coriander', 'Olives', 'Onions', 'Garlic', 'Tomatoes', 'Peppers', 'Avocado', 'Spicy food', 'Coconut', 'Sesame', 'Celery', 'Mustard', 'Beans', 'Lentils', 'Chickpeas']
export const INGREDIENT_NAMES: string[] = [...new Set([...EXTRA_AVOID, ...RECIPES.flatMap((r) => r.ing.map((i) => i.item[0].toUpperCase() + i.item.slice(1)))])]
