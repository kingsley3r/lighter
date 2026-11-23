/** Everyday foods and drinks with a typical portion. Values per portion. Used for instant suggestions while typing. */
export interface CommonFood { name: string; portion: string; kcal: number; p: number; c: number; f: number; drink?: boolean; ml?: number }

const F = (name: string, portion: string, kcal: number, p: number, c: number, f: number): CommonFood => ({ name, portion, kcal, p, c, f })
const D = (name: string, ml: number, kcal: number, p: number, c: number, f: number): CommonFood => ({ name, portion: `${ml} ml`, kcal, p, c, f, drink: true, ml })

export const COMMON_FOODS: CommonFood[] = [
  F('Egg, boiled', '1 egg', 78, 6, 0.6, 5),
  F('Eggs, scrambled', '2 eggs', 200, 13, 2, 15),
  F('Eggs, fried', '2 eggs', 180, 12, 1, 14),
  F('Eggs with bacon', '2 eggs + 2 slices', 330, 21, 1, 27),
  F('Eggs on toast', '2 eggs + 1 slice', 250, 15, 15, 14),
  F('Omelette with cheese', '3 eggs', 380, 26, 2, 30),
  F('Omelette with vegetables', '3 eggs', 280, 20, 6, 19),
  F('Bacon', '2 slices', 90, 6, 0, 7),
  F('Toast with butter', '1 slice', 120, 3, 14, 6),
  F('Toast with jam', '1 slice', 130, 3, 25, 2),
  F('Bread roll', '1 roll', 150, 5, 29, 1),
  F('Bread roll with cheese', '1 roll', 260, 12, 29, 10),
  F('Bread roll with ham', '1 roll', 220, 12, 30, 5),
  F('Wholegrain bread', '1 slice', 100, 4, 17, 1),
  F('Peanut butter toast', '1 slice', 200, 7, 17, 11),
  F('Avocado toast', '1 slice', 240, 5, 20, 15),
  F('Oatmeal with milk', '1 bowl', 290, 12, 45, 7),
  F('Overnight oats', '1 jar', 350, 15, 50, 9),
  F('Muesli with milk', '1 bowl', 330, 11, 55, 7),
  F('Cornflakes with milk', '1 bowl', 250, 8, 45, 3),
  F('Greek yogurt', '150 g', 150, 15, 6, 7),
  F('Skyr / quark, plain', '150 g', 95, 17, 6, 0.3),
  F('Yogurt with granola', '1 bowl', 320, 12, 42, 11),
  F('Protein shake with water', '1 scoop', 120, 24, 3, 1.5),
  F('Protein shake with milk', '1 scoop + 300 ml', 260, 34, 18, 6),
  F('Banana', '1 medium', 105, 1.3, 27, 0.4),
  F('Apple', '1 medium', 95, 0.5, 25, 0.3),
  F('Orange', '1 medium', 62, 1.2, 15, 0.2),
  F('Berries', '1 cup', 70, 1, 17, 0.5),
  F('Grapes', '1 cup', 104, 1, 27, 0.2),
  F('Almonds', '30 g', 175, 6, 6, 15),
  F('Mixed nuts', '30 g', 180, 5, 6, 16),
  F('Rice cakes', '2 cakes', 70, 1.5, 15, 0.5),
  F('Protein bar', '1 bar', 210, 20, 22, 7),
  F('Chocolate bar', '1 bar (50 g)', 270, 3, 30, 15),
  F('Crisps / chips', '1 small bag', 160, 2, 15, 10),
  F('Chicken breast, grilled', '150 g', 240, 46, 0, 5),
  F('Chicken with rice', '1 plate', 550, 42, 65, 12),
  F('Chicken with rice and vegetables', '1 plate', 580, 44, 68, 13),
  F('Chicken salad', '1 bowl', 380, 35, 12, 21),
  F('Chicken wrap', '1 wrap', 480, 30, 45, 18),
  F('Chicken nuggets', '6 pieces', 290, 15, 18, 18),
  F('Döner kebab', '1 piece', 700, 35, 65, 32),
  F('Falafel wrap', '1 wrap', 560, 16, 70, 24),
  F('Burger', '1 burger', 550, 28, 42, 29),
  F('Cheeseburger', '1 burger', 600, 31, 42, 33),
  F('French fries', '1 medium', 340, 4, 44, 16),
  F('Pizza margherita', '1 pizza', 900, 36, 110, 34),
  F('Pizza salami', '1 pizza', 1050, 44, 108, 48),
  F('Pizza', '1 slice', 280, 12, 33, 11),
  F('Spaghetti bolognese', '1 plate', 650, 32, 80, 21),
  F('Pasta with tomato sauce', '1 plate', 480, 15, 85, 9),
  F('Pasta carbonara', '1 plate', 750, 30, 75, 36),
  F('Lasagne', '1 portion', 600, 30, 45, 33),
  F('Rice, cooked', '1 cup (180 g)', 230, 4.5, 50, 0.5),
  F('Potatoes, boiled', '250 g', 190, 5, 42, 0.3),
  F('Mashed potatoes', '1 portion', 240, 5, 35, 9),
  F('Salmon fillet', '150 g', 310, 31, 0, 20),
  F('Salmon with potatoes and vegetables', '1 plate', 600, 38, 50, 25),
  F('Tuna, canned in water', '1 can (130 g)', 140, 32, 0, 1),
  F('Steak', '200 g', 500, 50, 0, 33),
  F('Schnitzel with fries', '1 plate', 950, 40, 85, 48),
  F('Bratwurst', '1 sausage', 300, 13, 1, 27),
  F('Currywurst with fries', '1 plate', 800, 20, 70, 48),
  F('Chili con carne', '1 bowl', 450, 32, 35, 18),
  F('Burrito', '1 burrito', 750, 32, 90, 27),
  F('Sushi', '8 pieces', 350, 14, 60, 5),
  F('Fried rice', '1 plate', 600, 18, 80, 22),
  F('Ramen', '1 bowl', 550, 22, 70, 20),
  F('Curry with rice', '1 plate', 700, 28, 85, 26),
  F('Lentil soup', '1 bowl', 280, 16, 40, 5),
  F('Tomato soup', '1 bowl', 150, 4, 22, 5),
  F('Mixed salad with dressing', '1 bowl', 180, 3, 10, 14),
  F('Caesar salad', '1 bowl', 450, 25, 15, 32),
  F('Sandwich with ham and cheese', '1 sandwich', 400, 22, 35, 18),
  F('Club sandwich', '1 sandwich', 600, 32, 45, 32),
  F('Bagel with cream cheese', '1 bagel', 360, 12, 55, 10),
  F('Croissant', '1 piece', 230, 5, 26, 12),
  F('Pancakes with syrup', '3 pancakes', 520, 12, 90, 12),
  F('Waffles', '2 waffles', 400, 9, 50, 18),
  F('Ice cream', '2 scoops', 270, 5, 30, 14),
  F('Cake', '1 slice', 350, 4, 45, 17),
  F('Cookies', '2 cookies', 160, 2, 22, 8),
  F('Cottage cheese', '200 g', 200, 24, 6, 9),
  F('Cheese', '30 g', 120, 8, 0, 10),
  F('Hummus with vegetables', '1 bowl', 250, 8, 20, 15),
  D('Water', 250, 0, 0, 0, 0),
  D('Sparkling water', 500, 0, 0, 0, 0),
  D('Coffee, black', 250, 2, 0.3, 0, 0),
  D('Coffee with milk', 250, 40, 2, 3, 2),
  D('Cappuccino', 250, 110, 6, 9, 5),
  D('Latte macchiato', 350, 170, 9, 14, 9),
  D('Flat white', 200, 110, 6, 9, 6),
  D('Espresso', 30, 2, 0.1, 0, 0),
  D('Tea, unsweetened', 250, 2, 0, 0, 0),
  D('Green tea', 250, 2, 0, 0, 0),
  D('Milk, 1.5%', 250, 120, 8.5, 12, 4),
  D('Oat milk', 250, 120, 2.5, 17, 4),
  D('Orange juice', 250, 110, 2, 26, 0.5),
  D('Apple juice', 250, 115, 0.3, 28, 0.3),
  D('Apple spritzer (Apfelschorle)', 500, 120, 0.3, 28, 0.3),
  D('Cola', 330, 140, 0, 35, 0),
  D('Cola zero / diet soda', 330, 1, 0, 0, 0),
  D('Energy drink', 250, 115, 0, 28, 0),
  D('Energy drink, sugar free', 250, 5, 0, 1, 0),
  D('Iced tea', 500, 140, 0, 35, 0),
  D('Smoothie', 250, 140, 1.5, 32, 0.5),
  D('Beer', 500, 215, 2.5, 18, 0),
  D('Beer, alcohol free', 500, 110, 2, 24, 0),
  D('Wine, red', 150, 125, 0.1, 4, 0),
  D('Wine, white', 150, 120, 0.1, 4, 0),
  D('Aperol spritz', 250, 180, 0, 15, 0),
  D('Hot chocolate', 250, 200, 8, 28, 6),
  D('Protein shake (ready to drink)', 330, 200, 30, 12, 3),
]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
// Treat "eggs"/"egg", "potatoes"/"potato" etc. as the same word
const stem = (w: string) => w.replace(/(es|s)$/, '')

/** Parse a leading quantity, e.g. "2 egg" -> {qty: 2, rest: 'egg'}, "1/2 pizza" -> 0.5 */
export function parseQty(q: string): { qty: number | null; rest: string } {
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?|\d+\/\d+|half|one|two|three|four)\s*x?\s+(.*)$/i)
  if (!m) return { qty: null, rest: q.trim() }
  const words: Record<string, number> = { half: 0.5, one: 1, two: 2, three: 3, four: 4 }
  const raw = m[1].toLowerCase()
  const qty = words[raw] ?? (raw.includes('/') ? Number(raw.split('/')[0]) / Number(raw.split('/')[1]) : Number(raw.replace(',', '.')))
  return { qty: isFinite(qty) && qty > 0 ? qty : null, rest: m[2] }
}

/** Score how well a phrase matches the typed words. Every typed word must be a prefix of some word in the name. */
export function matchScore(name: string, typed: string): number {
  const words = norm(name).split(/[^a-z0-9]+/).filter(Boolean)
  const parts = norm(typed).split(/[^a-z0-9]+/).filter(Boolean)
  if (!parts.length) return 0
  let score = 0
  for (const p of parts) {
    const ps = stem(p)
    const i = words.findIndex((w) => w.startsWith(p) || stem(w).startsWith(ps))
    if (i < 0) return 0
    score += i === 0 ? 3 : 1
  }
  return score - words.length * 0.05
}

export function suggestFoods(typed: string, opts: { drinksOnly?: boolean; limit?: number } = {}): (CommonFood & { qty: number })[] {
  const { qty, rest } = parseQty(typed)
  if (rest.length < 2) return []
  return COMMON_FOODS.filter((f) => !opts.drinksOnly || f.drink)
    .map((f) => ({ f, s: matchScore(f.name, rest) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, opts.limit ?? 6)
    .map(({ f }) => {
      // "2 egg" on a 1-egg portion means 2 portions; on a "2 eggs" portion it means 1
      const per = Number(f.portion.match(/^(\d+)/)?.[1] ?? 1)
      const n = qty == null ? 1 : /egg|slice|piece|roll|cake|cookie|pancake|waffle|scoop|bar|wrap|burger|nugget/.test(f.portion) && per > 1 ? qty / per : qty
      return { ...f, qty: Math.round(n * 100) / 100 }
    })
}
