import { generateText, Output } from 'ai'
import { z } from 'zod'
import { AI_MODEL, aiErrorMessage, db, getCaller, json, useQuota } from './_lib/auth.js'

const meal = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  name: z.string(),
  emoji: z.string().describe('one food emoji'),
  minutes: z.number(),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  ingredients: z.array(z.object({ item: z.string(), qty: z.number(), unit: z.string().describe('g, ml, pcs, tbsp, tsp, slice, can, clove') })),
  steps: z.array(z.string()).describe('2-5 short steps'),
})
const schema = z.object({ days: z.array(z.object({ meals: z.array(meal) })).length(7) })

export async function POST(req: Request) {
  const caller = await getCaller(req)
  if (!caller) return json({ error: 'Please sign in again.' }, 401)
  const body = await req.json().catch(() => ({}))
  const weekStart = String(body?.week_start ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return json({ error: 'Bad week' }, 400)

  const pr = await db(caller, `profiles?select=*&id=eq.${caller.id}`)
  const profile = (await pr.json())?.[0]
  if (!profile) return json({ error: 'Profile missing' }, 400)

  const over = await useQuota(caller, 'meal_plan')
  if (over) return json({ error: over }, 429)

  const kcal = profile.kcal_target ?? 2000
  const prompt = `Create a 7-day meal plan (Monday to Sunday) for someone losing weight who cooks at home.
Daily target: about ${kcal} kcal (±5 %) and at least ${profile.protein_target_g ?? 120} g protein.
Each day: breakfast, lunch, dinner and one snack. Lunch may reuse the previous dinner as leftovers to save time.
Diet: ${(profile.diet_tags ?? []).join(', ') || 'no restrictions'}. Never use: ${profile.avoid_foods || 'nothing specific'}.
Max cooking time per meal: ${profile.cook_time_min ?? 30} minutes. Use affordable supermarket ingredients (Germany/Europe), metric units, and reuse ingredients across the week to keep the shopping list short.
Simple, tasty, filling meals with lots of vegetables. Quantities are for one person. Write in English.`

  try {
    const { output } = await generateText({
      model: AI_MODEL,
      output: Output.object({ schema }),
      maxOutputTokens: 12000,
      prompt,
    })
    const start = new Date(weekStart + 'T00:00:00Z')
    const days = output.days.map((d, i) => {
      const dt = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10)
      return {
        date: dt,
        meals: d.meals.map((m) => ({ ...m, recipe_id: 'ai', servings: 1, kcal: Math.round(m.kcal), protein_g: Math.round(m.protein_g), carbs_g: Math.round(m.carbs_g), fat_g: Math.round(m.fat_g) })),
      }
    })
    return json({ plan: { kcal_target: kcal, days, source: 'ai' } })
  } catch (e) {
    console.error('meal plan failed', e)
    return json({ error: aiErrorMessage(e) }, 503)
  }
}
