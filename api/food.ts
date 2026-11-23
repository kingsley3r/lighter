import { json } from './_lib/auth.js'

const FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_quantity,image_small_url'
const UA = 'Lighter/1.0 (personal fitness tracker)'

async function get(url: string, ms = 8000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal })
  } finally {
    clearTimeout(t)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const norm = (p: any) => ({ ...p, brands: Array.isArray(p?.brands) ? p.brands.join(', ') : p?.brands })

async function search(q: string): Promise<unknown[] | null> {
  // 1) Search-a-licious (current Open Food Facts full-text search)
  try {
    const r = await get(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=25&fields=${FIELDS}`)
    if (r.ok) {
      const d = await r.json()
      const hits = d?.hits ?? d?.products
      if (Array.isArray(hits) && hits.length) return hits.map(norm)
    } else console.error('search-a-licious', r.status)
  } catch (e) {
    console.error('search-a-licious failed', e)
  }
  // 2) Legacy search
  try {
    const r = await get(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`)
    if (r.ok) {
      const d = await r.json()
      return (d?.products ?? []).map(norm)
    }
    console.error('legacy search', r.status)
  } catch (e) {
    console.error('legacy search failed', e)
  }
  return null
}

export async function GET(req: Request) {
  const u = new URL(req.url)
  const q = u.searchParams.get('q')
  const barcode = u.searchParams.get('barcode')
  try {
    if (barcode) {
      if (!/^\d{6,14}$/.test(barcode)) return json({ error: 'Invalid barcode' }, 400)
      const r = await get(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${FIELDS}`)
      const data = await r.json()
      return json(data, 200)
    }
    if (q && q.length >= 2 && q.length <= 80) {
      const products = await search(q)
      if (!products) return json({ error: 'Food search is busy, try again in a moment.' }, 502)
      return new Response(JSON.stringify({ products }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': products.length ? 'public, s-maxage=86400' : 'no-store' },
      })
    }
    return json({ error: 'Missing query' }, 400)
  } catch {
    return json({ error: 'Food database unavailable right now.' }, 502)
  }
}
