import { generateText, Output } from 'ai'
import { z } from 'zod'
import { AI_MODEL, aiErrorMessage, getCaller, json, useQuota } from './_lib/auth.js'

const schema = z.object({
  is_food: z.boolean().describe('false if the photo does not show food or drink'),
  title: z.string().describe('Short name for the whole meal, e.g. "Spaghetti bolognese with side salad"'),
  items: z.array(
    z.object({
      name: z.string(),
      grams: z.number().describe('Estimated edible weight in grams'),
      kcal: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
    }),
  ),
  confidence: z.enum(['low', 'medium', 'high']),
})

const PROMPT = `You are a nutrition assistant in a weight-loss app. Identify every food and drink in the photo.
For each item estimate the portion in grams from visual cues (plate ~26 cm, fork, hand, packaging) and give calories and macros for that portion, using typical home-cooked values (include visible oil, butter, sauces and dressings).
Be realistic, not optimistic: people tend to underestimate. Use English names. If the user adds a note, take it into account.`

const TEXT_PROMPT = `You are a nutrition assistant in a weight-loss app. The user describes what they ate in their own words (any language).
Split it into items, assume typical portion sizes when no amount is given, and give calories and macros for each item using typical values (include cooking oil when the dish is usually fried).
Be realistic, not optimistic. Use English names. is_food is false only if the text clearly isn't about food or drink.`

export async function POST(req: Request) {
  const caller = await getCaller(req)
  if (!caller) return json({ error: 'Please sign in again.' }, 401)
  const body = await req.json().catch(() => null)
  const image: string | undefined = body?.image
  const text = String(body?.text ?? '').trim().slice(0, 500)
  if (image && (!image.startsWith('data:image/') || image.length > 4_000_000)) return json({ error: 'Photo too large.' }, 400)
  if (!image && text.length < 3) return json({ error: 'Add a photo or describe what you ate.' }, 400)
  const hint = String(body?.hint ?? '').slice(0, 300)

  const over = await useQuota(caller, 'scan')
  if (over) return json({ error: over }, 429)

  try {
    const { output } = await generateText({
      model: AI_MODEL,
      output: Output.object({ schema }),
      maxOutputTokens: 1200,
      messages: [
        {
          role: 'user',
          content: image
            ? [
                { type: 'text', text: PROMPT + (hint ? `\nUser note: ${hint}` : '') },
                { type: 'image', image },
              ]
            : [{ type: 'text', text: TEXT_PROMPT + `\nWhat I ate: ${text}` }],
        },
      ],
    })
    if (!output.is_food) return json({ error: 'That doesn’t look like food. Try another photo.' }, 422)
    return json(output)
  } catch (e) {
    console.error('scan failed', e)
    return json({ error: aiErrorMessage(e) }, 503)
  }
}
