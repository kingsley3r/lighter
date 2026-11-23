import { generateText, Output } from 'ai'
import { z } from 'zod'
import { AI_MODEL, aiErrorMessage, getCaller, json, useQuota } from './_lib/auth.js'

const dish = z.object({
  name: z.string().describe('Dish name as on the menu, in English'),
  kcal: z.number().describe('Calories for the normal restaurant portion'),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  verdict: z.enum(['great', 'ok', 'heavy']).describe('great = fits a weight-loss day well, heavy = very high calories or fat'),
  tip: z.string().describe('One short, practical ordering tip for this dish, e.g. "Ask for dressing on the side (−150 kcal)"'),
})
const schema = z.object({
  is_food: z.boolean().describe('false if the input is not about food, drinks or a menu'),
  restaurant_note: z.string().describe('One sentence about this restaurant or cuisine for someone losing weight. Empty if unknown.'),
  dishes: z.array(dish).describe('The asked dish, or for a menu photo up to 8 of the most relevant dishes'),
})

const PROMPT = `You are a nutrition coach in a weight-loss app helping someone decide what to order at a restaurant.
Estimate calories and macros for a typical restaurant portion (restaurants use more oil, butter and sugar than home cooking; be realistic, not optimistic).
If a known chain is named, use its published nutrition values when you know them.
Judge each dish against the calories the user has left today.
Write in English, keep tips short and specific.`

export async function POST(req: Request) {
  const caller = await getCaller(req)
  if (!caller) return json({ error: 'Please sign in again.' }, 401)
  const body = await req.json().catch(() => null)
  const image: string | undefined = body?.image
  const place = String(body?.place ?? '').trim().slice(0, 80)
  const text = String(body?.text ?? '').trim().slice(0, 300)
  const left = Math.round(Number(body?.kcal_left) || 0)
  if (image && (!image.startsWith('data:image/') || image.length > 4_000_000)) return json({ error: 'Photo too large.' }, 400)
  if (!image && text.length < 2) return json({ error: 'Type a dish or take a photo of the menu.' }, 400)

  const over = await useQuota(caller, 'scan')
  if (over) return json({ error: over }, 429)

  const ctx = `${PROMPT}\nCalories left today: ${left > 0 ? left : 'unknown'}.${place ? `\nRestaurant: ${place}` : ''}`
  try {
    const { output } = await generateText({
      model: AI_MODEL,
      output: Output.object({ schema }),
      maxOutputTokens: 1800,
      messages: [{
        role: 'user',
        content: image
          ? [{ type: 'text', text: `${ctx}\nThis is a photo of the menu. Pick up to 8 dishes, include the lightest good options and the most popular ones.${text ? ` The user is considering: ${text}` : ''}` }, { type: 'image', image }]
          : [{ type: 'text', text: `${ctx}\nDish: ${text}. If it's a general dish, give one entry. If the user lists several, give one entry each.` }],
      }],
    })
    if (!output.is_food) return json({ error: 'That doesn’t look like food or a menu. Try again.' }, 422)
    return json(output)
  } catch (e) {
    console.error('restaurant failed', e)
    return json({ error: aiErrorMessage(e) }, 503)
  }
}
