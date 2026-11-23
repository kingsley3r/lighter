import { json } from './_lib/auth.js'

// Free recipe database with photos (TheMealDB, public test key "1").
const BASE = 'https://www.themealdb.com/api/json/v1/1'
const CATS = new Set(['Beef', 'Breakfast', 'Chicken', 'Dessert', 'Goat', 'Lamb', 'Miscellaneous', 'Pasta', 'Pork', 'Seafood', 'Side', 'Starter', 'Vegan', 'Vegetarian'])

async function get(path: string, ms = 7000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(BASE + path, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`mealdb ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

interface Lite { id: string; name: string; thumb: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lite = (m: any): Lite => ({ id: String(m.idMeal), name: String(m.strMeal).trim(), thumb: String(m.strMealThumb ?? '') })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function full(m: any) {
  const ingredients: { item: string; measure: string }[] = []
  for (let n = 1; n <= 20; n++) {
    const item = String(m[`strIngredient${n}`] ?? '').trim()
    if (item) ingredients.push({ item, measure: String(m[`strMeasure${n}`] ?? '').trim() })
  }
  const steps = String(m.strInstructions ?? '')
    .split(/\r?\n+/)
    .map((s) => s.replace(/^\s*(step\s*)?\d+[.):]?\s*/i, '').trim())
    .filter((s) => s.length > 3)
  return {
    ...lite(m),
    category: m.strCategory ?? null,
    area: m.strArea ?? null,
    ingredients,
    steps,
    youtube: m.strYoutube || null,
    source: m.strSource || null,
  }
}

const clean = (s: string) => s.trim().toLowerCase().replace(/[^a-z\s-]/g, '').replace(/\s+/g, '_')

async function byIngredient(name: string): Promise<Lite[]> {
  const base = clean(name)
  if (!base) return []
  const tries = [base, base.endsWith('s') ? base.slice(0, -1) : base + 's']
  for (const t of tries) {
    const d = await get(`/filter.php?i=${encodeURIComponent(t)}`).catch(() => null)
    if (d?.meals?.length) return d.meals.map(lite)
  }
  return []
}

const cached = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })

export async function GET(req: Request) {
  const u = new URL(req.url)
  try {
    const id = u.searchParams.get('id')
    if (id) {
      if (!/^\d{1,8}$/.test(id)) return json({ error: 'Bad id' }, 400)
      const d = await get(`/lookup.php?i=${id}`)
      const m = d?.meals?.[0]
      return m ? cached({ recipe: full(m) }) : json({ error: 'Not found' }, 404)
    }

    const q = (u.searchParams.get('q') ?? '').trim()
    if (q) {
      if (q.length > 60) return json({ error: 'Too long' }, 400)
      const d = await get(`/search.php?s=${encodeURIComponent(q)}`)
      return cached({ recipes: (d?.meals ?? []).slice(0, 24).map(full) })
    }

    const cat = u.searchParams.get('cat')
    if (cat) {
      if (!CATS.has(cat)) return json({ error: 'Unknown category' }, 400)
      const d = await get(`/filter.php?c=${encodeURIComponent(cat)}`)
      return cached({ recipes: (d?.meals ?? []).slice(0, 40).map(lite) })
    }

    if (u.searchParams.get('all')) {
      // every recipe in the database (light entries), grouped by category
      const lists = await Promise.all([...CATS].map((c) => get(`/filter.php?c=${encodeURIComponent(c)}`).then((d) => (d?.meals ?? []).map((m: unknown) => ({ ...lite(m), category: c }))).catch(() => [])))
      const seen = new Set<string>()
      const out = lists.flat().filter((m) => !seen.has(m.id) && seen.add(m.id)).sort((a, b) => a.name.localeCompare(b.name))
      return cached({ recipes: out })
    }

    const ing = (u.searchParams.get('ing') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6)
    if (ing.length) {
      const lists = await Promise.all(ing.map(byIngredient))
      const score = new Map<string, { m: Lite; hits: number }>()
      lists.forEach((list) => list.forEach((m) => {
        const cur = score.get(m.id)
        if (cur) cur.hits++
        else score.set(m.id, { m, hits: 1 })
      }))
      const top = [...score.values()].sort((a, b) => b.hits - a.hits).slice(0, 30)
      const details = await Promise.all(top.map(({ m }) => get(`/lookup.php?i=${m.id}`).then((d) => d?.meals?.[0]).catch(() => null)))
      // weight-loss app: keep desserts at the end
      const out = details.filter(Boolean).map(full).sort((a, b) => Number(a.category === 'Dessert') - Number(b.category === 'Dessert')).slice(0, 12)
      return cached({ recipes: out })
    }

    return json({ error: 'Missing query' }, 400)
  } catch (e) {
    console.error('recipes failed', e)
    return json({ error: 'Recipe database unavailable right now.' }, 502)
  }
}
