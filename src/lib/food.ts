export interface FoodItem {
  code: string
  name: string
  brand?: string
  kcal100: number
  protein100: number
  carbs100: number
  fat100: number
  servingG?: number
  image?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduct(p: any): FoodItem | null {
  const n = p?.nutriments ?? {}
  const kcal = Number(n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : NaN))
  const name = (p.product_name_en || p.product_name || '').trim()
  if (!name || !isFinite(kcal)) return null
  return {
    code: String(p.code ?? ''),
    name,
    brand: (p.brands || '').split(',')[0]?.trim() || undefined,
    kcal100: Math.round(kcal),
    protein100: Number(n.proteins_100g ?? 0),
    carbs100: Number(n.carbohydrates_100g ?? 0),
    fat100: Number(n.fat_100g ?? 0),
    servingG: p.serving_quantity ? Number(p.serving_quantity) : undefined,
    image: p.image_small_url,
  }
}

export async function searchFoods(q: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const res = await fetch(`/api/food?q=${encodeURIComponent(q)}`, { signal })
  if (!res.ok) throw new Error('Food search is unavailable right now.')
  const data = await res.json()
  return (data.products ?? []).map(mapProduct).filter(Boolean) as FoodItem[]
}

export async function lookupBarcode(code: string): Promise<FoodItem | null> {
  const res = await fetch(`/api/food?barcode=${encodeURIComponent(code)}`)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 1) return null
  return mapProduct({ ...data.product, code })
}

export function scale(f: FoodItem, grams: number) {
  const k = grams / 100
  return {
    kcal: Math.round(f.kcal100 * k),
    protein_g: Math.round(f.protein100 * k * 10) / 10,
    carbs_g: Math.round(f.carbs100 * k * 10) / 10,
    fat_g: Math.round(f.fat100 * k * 10) / 10,
  }
}
