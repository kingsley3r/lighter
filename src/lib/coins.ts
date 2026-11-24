import { supabase } from './supabase'

/** Mirrors the prices in the buy_item database function (the server decides). */
export function priceOf(id: string): number {
  if (['crown', 'medal', 'cape'].includes(id)) return 150
  if (id === 'stadium') return 200
  if (['cap', 'beanie', 'chef', 'party', 'viking'].includes(id)) return 60
  if (['shades', 'bands', 'bowtie', 'scarf', 'headphones'].includes(id)) return 80
  return 100
}

/** Returns the new balance, or null if this source already paid out today. */
export async function earnCoins(src: string, amount: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('earn_coins', { p_src: src, p_amount: Math.round(amount) })
  if (error) throw error
  return (data as number | null) ?? null
}

export async function buyItem(id: string): Promise<number> {
  const { data, error } = await supabase.rpc('buy_item', { p_item: id })
  if (error) throw new Error(error.message.includes('not enough') ? 'Not enough coins yet' : error.message)
  return data as number
}
