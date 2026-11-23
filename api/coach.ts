import { generateText } from 'ai'
import { AI_MODEL, aiErrorMessage, db, getCaller, json, useQuota, type Caller } from './_lib/auth.js'

interface Msg { role: 'user' | 'assistant'; content: string }

async function rows<T>(c: Caller, path: string): Promise<T[]> {
  const r = await db(c, path)
  return r.ok ? ((await r.json()) as T[]) : []
}

/** Builds a compact summary of the user's real data for the coach. */
async function context(c: Caller, tz: string) {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  const offset = now.getTime() - local.getTime()
  const start = new Date(local); start.setHours(0, 0, 0, 0)
  const todayStart = new Date(start.getTime() + offset)
  const weekAgo = new Date(todayStart.getTime() - 7 * 864e5)
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  const [prof] = await rows<Record<string, unknown>>(c, `profiles?select=display_name,sex,birth_year,height_cm,start_weight_kg,target_weight_kg,kcal_target,protein_target_g,water_target_ml,step_target,diet_tags,avoid_foods,training_days,equipment,cook_time_min&id=eq.${c.id}`)
  const [meals, week, weights, steps, water, workouts, plan, goals] = await Promise.all([
    rows<{ name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; meal_type: string; eaten_at: string }>(c, `meal_logs?select=name,kcal,protein_g,carbs_g,fat_g,meal_type,eaten_at&eaten_at=gte.${todayStart.toISOString()}&order=eaten_at`),
    rows<{ kcal: number; protein_g: number; eaten_at: string }>(c, `meal_logs?select=kcal,protein_g,eaten_at&eaten_at=gte.${weekAgo.toISOString()}&eaten_at=lt.${todayStart.toISOString()}`),
    rows<{ logged_on: string; weight_kg: number }>(c, `weight_logs?select=logged_on,weight_kg&order=logged_on.desc&limit=21`),
    rows<{ day: string; steps: number }>(c, `step_logs?select=day,steps&day=gte.${ymd(weekAgo)}&order=day`),
    rows<{ amount_ml: number }>(c, `water_logs?select=amount_ml&logged_at=gte.${todayStart.toISOString()}`),
    rows<{ done_at: string; title: string; duration_min: number | null; distance_m: number | null }>(c, `workout_logs?select=done_at,title,duration_min,distance_m&done_at=gte.${weekAgo.toISOString()}&order=done_at`),
    rows<{ plan: { workouts: { weekday: number; title: string; minutes: number }[] } }>(c, `workout_plans?select=plan&is_active=eq.true&limit=1`),
    rows<{ week_start: string; goal: { kind: string; target: number } }>(c, `weekly_goals?select=week_start,goal&order=week_start.desc&limit=1`),
  ])
  const sum = (a: { kcal: number }[]) => a.reduce((s, x) => s + Number(x.kcal), 0)
  const kT = Number(prof?.kcal_target ?? 2000)
  const days = new Map<string, { kcal: number; p: number }>()
  for (const m of week) { const k = new Date(new Date(m.eaten_at).getTime() - offset).toISOString().slice(0, 10); const d = days.get(k) ?? { kcal: 0, p: 0 }; d.kcal += Number(m.kcal); d.p += Number(m.protein_g); days.set(k, d) }
  const weekday = (local.getDay() + 6) % 7
  const todayWorkout = plan[0]?.plan?.workouts?.find((w) => w.weekday === weekday)
  const lines = [
    `Now: ${local.toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' })} (${tz})`,
    `Profile: ${JSON.stringify(prof ?? {})}`,
    `Today eaten: ${sum(meals)} of ${kT} kcal (${kT - sum(meals)} left). Protein ${Math.round(meals.reduce((s, m) => s + Number(m.protein_g), 0))} of ${prof?.protein_target_g ?? '?'} g.`,
    `Today meals: ${meals.map((m) => `${m.meal_type ?? 'meal'}: ${m.name} (${m.kcal} kcal, P${Math.round(m.protein_g)})`).join('; ') || 'none yet'}`,
    `Water today: ${water.reduce((s, w) => s + w.amount_ml, 0)} ml of ${prof?.water_target_ml ?? 2500}`,
    `Last 7 days kcal/protein per logged day: ${[...days].map(([k, d]) => `${k}: ${Math.round(d.kcal)} kcal, P${Math.round(d.p)}`).join('; ') || 'no logs'}`,
    `Weigh-ins (newest first): ${weights.map((w) => `${w.logged_on} ${w.weight_kg}`).join(', ') || 'none'}`,
    `Steps last days: ${steps.map((s) => `${s.day} ${s.steps}`).join(', ') || 'none'} (goal ${prof?.step_target ?? 8000})`,
    `Workouts last 7 days: ${workouts.map((w) => `${w.done_at.slice(0, 10)} ${w.title}${w.distance_m ? ` ${(w.distance_m / 1000).toFixed(1)} km` : ''}`).join('; ') || 'none'}`,
    `Planned workout today: ${todayWorkout ? `${todayWorkout.title} (~${todayWorkout.minutes} min)` : 'rest day'}`,
    `Weekly goal: ${goals[0] ? JSON.stringify(goals[0]) : 'none'}`,
  ]
  return lines.join('\n')
}

const SYSTEM = `You are Pip, a small, cheerful sprout who is the user's buddy and coach inside the weight-loss app "Lighter".
Answer in the language the user writes in. Be warm, short and practical: usually 2–6 sentences or a short list. Use at most one or two emojis.
Base answers on the user's real data below. When suggesting food, give concrete dishes with approximate kcal and protein that fit the calories left today, using foods they like and avoiding their avoid list.
Encourage, never shame. Don't give medical diagnoses; for health problems, pain, pregnancy, eating disorders or medication, gently suggest talking to a doctor.
Never invent data you don't have. If something isn't logged, say so.`

export async function POST(req: Request) {
  const caller = await getCaller(req)
  if (!caller) return json({ error: 'Please sign in again.' }, 401)
  const body = (await req.json().catch(() => null)) as { messages?: Msg[]; tz?: string } | null
  const msgs = (body?.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }))
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json({ error: 'Ask Pip something.' }, 400)
  let tz = 'Europe/Berlin'
  try { if (body?.tz) { new Intl.DateTimeFormat('en', { timeZone: body.tz }); tz = body.tz } } catch { /* keep default */ }

  const over = await useQuota(caller, 'scan')
  if (over) return json({ error: over }, 429)
  try {
    const ctx = await context(caller, tz)
    const { text } = await generateText({ model: AI_MODEL, system: `${SYSTEM}\n\nUSER DATA\n${ctx}`, messages: msgs, maxOutputTokens: 700 })
    return json({ reply: text.trim() })
  } catch (e) {
    console.error('coach failed', e)
    return json({ error: aiErrorMessage(e) }, 503)
  }
}
