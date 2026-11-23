import { supabase } from './supabase'

export const AISLES = ['Fruit & veg', 'Meat & fish', 'Dairy & eggs', 'Bakery', 'Grains & pasta', 'Cans & jars', 'Spices & sauces', 'Baking', 'Nuts & seeds', 'Frozen', 'Drinks', 'Other'] as const
export type Aisle = (typeof AISLES)[number]
export const AISLE_ICON: Record<Aisle, string> = {
  'Fruit & veg': '🥦', 'Meat & fish': '🍗', 'Dairy & eggs': '🥚', Bakery: '🍞', 'Grains & pasta': '🍝', 'Cans & jars': '🥫',
  'Spices & sauces': '🧂', Baking: '🧁', 'Nuts & seeds': '🥜', Frozen: '🧊', Drinks: '🥤', Other: '🛒',
}

const RULES: [Aisle, RegExp][] = [
  ['Fruit & veg', /(bell|red|green|yellow|orange) peppers?|sweet potato/i],
  ['Cans & jars', /coconut milk|canned|tinned|\bcan of|\btin of/i],
  ['Drinks', /(almond|oat|soy|rice) milk/i],
  ['Frozen', /frozen|ice cream/i],
  ['Drinks', /\bjuice|soda|cola|coffee|\btea\b|wine|beer|sparkling|mineral water/i],
  ['Spices & sauces', /salt|pepper(corns)?\b|paprika|cumin|curry|turmeric|cinnamon|oregano|basil dried|thyme|rosemary|chili flakes|chilli powder|garam|spice|seasoning|stock|bouillon|broth|soy sauce|vinegar|mustard|ketchup|mayo|sriracha|hot sauce|worcestershire|pesto|tahini|honey|maple|syrup|oil\b|olive oil|sesame oil|dressing|fish sauce|oyster sauce|nutmeg|cardamom|cloves|bay lea|vanilla/i],
  ['Meat & fish', /chicken|turkey|beef|pork|lamb|mince|steak|bacon|ham\b|sausage|chorizo|salami|prosciutto|salmon|tuna(?! can| tin)|cod|fish|shrimp|prawn|mussel|squid|duck|veal|anchov/i],
  ['Dairy & eggs', /\begg|milk|yog(h)?urt|skyr|quark|cheese|feta|mozzarella|parmesan|cheddar|ricotta|halloumi|butter|cream|crème|creme|kefir|cottage/i],
  ['Bakery', /bread|toast|bagel|wrap|tortilla|pita|roll\b|rolls|bun\b|baguette|naan|croissant|crispbread/i],
  ['Grains & pasta', /rice|pasta|spaghetti|penne|noodle|oat|quinoa|couscous|bulgur|barley|flour|cereal|granola|muesli|lentil(?!s? can)|polenta|rice cake/i],
  ['Cans & jars', /can\b|canned|tin\b|tinned|chickpea|kidney bean|black bean|white bean|beans|passata|tomato paste|tomato puree|chopped tomatoes|coconut milk|olives|pickle|capers|jam|peanut butter|sweetcorn|corn\b/i],
  ['Nuts & seeds', /almond|walnut|cashew|peanut|pistachio|hazelnut|pecan|seed|chia|flax|linseed/i],
  ['Baking', /sugar|baking|yeast|cocoa|chocolate chips|sweetener|protein powder|whey/i],
  ['Fruit & veg', /apple|banana|berr|orange|lemon|lime|grape|pear|peach|plum|mango|pineapple|kiwi|melon|cherr|avocado|tomato|cucumber|lettuce|salad|spinach|kale|rocket|arugula|cabbage|broccoli|cauliflower|carrot|onion|shallot|garlic|ginger|potato|sweet potato|pepper|courgette|zucchini|aubergine|eggplant|mushroom|celery|leek|pea\b|peas|bean sprout|green bean|asparagus|beetroot|radish|corn on|squash|pumpkin|herb|parsley|coriander|cilantro|basil|mint|dill|chive|spring onion|scallion|chilli|chili|fruit|veg/i],
]

export function aisleFor(name: string): Aisle {
  for (const [a, r] of RULES) if (r.test(name)) return a
  return 'Other'
}

export interface ShopItem { id: number; name: string; qty: number | null; unit: string; note: string | null; aisle: Aisle; recipes: string[]; done: boolean }
export interface NewItem { name: string; qty?: number | null; unit?: string; note?: string | null; recipe?: string }

const clean = (s: string) => s.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
const keyOf = (name: string, unit: string) => clean(name).toLowerCase().replace(/(es|s)$/, '') + '|' + unit

export async function listItems(): Promise<ShopItem[]> {
  const { data } = await supabase.from('shopping_items').select('*').order('created_at')
  return (data ?? []) as ShopItem[]
}

/** Adds items, merging with open (unticked) items of the same name and unit. Returns how many lines were added or updated. */
export async function addItems(items: NewItem[]): Promise<number> {
  const cur = (await listItems()).filter((x) => !x.done)
  const byKey = new Map(cur.map((x) => [keyOf(x.name, x.unit), x]))
  const inserts: Omit<ShopItem, 'id' | 'done'>[] = []
  const updates: ShopItem[] = []
  for (const it of items) {
    const name = clean(it.name)
    if (!name) continue
    const unit = it.unit ?? ''
    const k = keyOf(name, unit)
    const hit = byKey.get(k) ?? (inserts.find((x) => keyOf(x.name, x.unit) === k) as ShopItem | undefined)
    if (hit) {
      if (it.qty != null) hit.qty = (Number(hit.qty) || 0) + it.qty
      if (it.note) hit.note = hit.note ? `${hit.note} + ${it.note}` : it.note
      if (it.recipe && !hit.recipes.includes(it.recipe)) hit.recipes = [...hit.recipes, it.recipe]
      if ('id' in hit && hit.id && !updates.includes(hit)) updates.push(hit)
    } else {
      inserts.push({ name: name[0].toUpperCase() + name.slice(1), qty: it.qty ?? null, unit, note: it.note ?? null, aisle: aisleFor(name), recipes: it.recipe ? [it.recipe] : [] })
    }
  }
  if (inserts.length) {
    const { error } = await supabase.from('shopping_items').insert(inserts)
    if (error) throw error
  }
  await Promise.all(updates.map((u) => supabase.from('shopping_items').update({ qty: u.qty, note: u.note, recipes: u.recipes }).eq('id', u.id)))
  return inserts.length + updates.length
}

export function fmtAmount(x: Pick<ShopItem, 'qty' | 'unit' | 'note'>) {
  const parts: string[] = []
  if (x.qty != null) {
    const q = x.unit === 'g' || x.unit === 'ml' ? Math.ceil(Number(x.qty) / 10) * 10 : Math.ceil(Number(x.qty) * 4) / 4
    parts.push(`${Number.isInteger(q) ? q : q.toFixed(2).replace(/\.?0+$/, '')} ${x.unit}`.trim())
  }
  if (x.note) parts.push(x.note)
  return parts.join(' + ')
}
