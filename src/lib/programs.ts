import { addDays, isoDate, parseDate } from './dates'
import type { PlannedWorkout } from './types'

export type ProgramId = 'c25k' | 'strength8'
export type Feel = 'easy' | 'right' | 'hard'
export interface ProgramState {
  id: ProgramId
  started_on: string
  week: number // 1-based
  day: number // 1..3 within the week
  last_on?: string | null
  easy_streak?: number
  history?: { on: string; week: number; day: number; feel: Feel }[]
  done?: boolean
}

export const PROGRAMS: { id: ProgramId; emoji: string; title: string; weeks: number; blurb: string }[] = [
  { id: 'c25k', emoji: '🏃', title: 'Couch to 5K', weeks: 9, blurb: '3 runs a week, ~30 min. Walk-run intervals that build up to 30 minutes of running.' },
  { id: 'strength8', emoji: '🏋️', title: '8-week strength', weeks: 8, blurb: '3 full-body sessions a week with your equipment. Reps drop and weight goes up every 2 weeks, with a lighter week at the end.' },
]
export const programInfo = (id: ProgramId) => PROGRAMS.find((p) => p.id === id)!

// ---- Couch to 5K ----
export interface Segment { kind: 'warm' | 'run' | 'walk' | 'cool'; s: number }
const rep = (n: number, ...xs: Segment[]) => Array.from({ length: n }, () => xs).flat()
const R = (min: number): Segment => ({ kind: 'run', s: Math.round(min * 60) })
const W = (min: number): Segment => ({ kind: 'walk', s: Math.round(min * 60) })
const C25K: Segment[][][] = [
  [rep(8, R(1), W(1.5))],
  [rep(6, R(1.5), W(2))],
  [rep(2, R(1.5), W(1.5), R(3), W(3))],
  [[R(3), W(1.5), R(5), W(2.5), R(3), W(1.5), R(5)]],
  [rep(3, R(5), W(3)), [R(8), W(5), R(8)], [R(20)]],
  [[R(5), W(3), R(8), W(3), R(5)], [R(10), W(3), R(10)], [R(25)]],
  [[R(25)]],
  [[R(28)]],
  [[R(30)]],
]
export function runSession(week: number, day: number): Segment[] {
  const w = C25K[Math.min(9, Math.max(1, week)) - 1]
  const main = w[Math.min(w.length, day) - 1] ?? w[0]
  return [{ kind: 'warm', s: 300 }, ...main, { kind: 'cool', s: 300 }]
}
export function describeRun(segs: Segment[]): string {
  const main = segs.filter((s) => s.kind === 'run' || s.kind === 'walk')
  const run = main.filter((s) => s.kind === 'run').reduce((a, s) => a + s.s, 0)
  const total = segs.reduce((a, s) => a + s.s, 0)
  if (main.length === 1) return `${Math.round(run / 60)} min run, no walking breaks · ${Math.round(total / 60)} min total`
  return `${main.filter((s) => s.kind === 'run').length} runs, ${Math.round(run / 60)} min running · ${Math.round(total / 60)} min total`
}

// ---- 8-week strength ----
export function strengthScheme(week: number): { sets: number; reps: string; note: string } {
  if (week <= 2) return { sets: 3, reps: '10', note: 'Learn the moves. Stop each set with 2–3 reps left in the tank.' }
  if (week <= 4) return { sets: 3, reps: '8', note: 'A bit heavier than weeks 1–2. Same form, fewer reps.' }
  if (week <= 6) return { sets: 4, reps: '6-8', note: 'Four sets now. Add weight when you hit 8 reps on every set.' }
  if (week === 7) return { sets: 4, reps: '5', note: 'Heaviest week. Long rests (2 min), perfect form.' }
  return { sets: 2, reps: '8', note: 'Deload: lighter weights so your body can recover and come back stronger.' }
}
/** Applies the week's sets/reps to a workout from the user's plan. Timed and cardio moves stay as they are. */
export function applyStrength(w: PlannedWorkout, week: number, easyStreak = 0): PlannedWorkout {
  const sc = strengthScheme(week)
  return {
    ...w,
    title: `${w.title} · W${week}`,
    focus: `${w.focus} · ${sc.sets}×${sc.reps}`,
    exercises: w.exercises.map((e) => (/s$|sec|min/i.test(e.reps) || e.rest_s === 0 ? e : { ...e, sets: sc.sets, reps: sc.reps, rest_s: week === 7 ? 120 : 75, cue: easyStreak >= 2 ? `${e.cue} Felt easy lately: go ~5% heavier.` : e.cue })),
  }
}

// ---- progression ----
export function startProgram(id: ProgramId): ProgramState {
  return { id, started_on: isoDate(), week: 1, day: 1, last_on: null, easy_streak: 0, history: [] }
}

/** Long break? Step back a week so the comeback isn't too hard. */
export function checkBreak(p: ProgramState): { state: ProgramState; steppedBack: boolean } {
  if (!p.last_on || p.done) return { state: p, steppedBack: false }
  const gap = (Date.now() - parseDate(p.last_on).getTime()) / 864e5
  if (gap > 10 && p.week > 1) return { state: { ...p, week: p.week - 1, day: 1, last_on: isoDate(addDays(new Date(), -1)) }, steppedBack: true }
  return { state: p, steppedBack: false }
}

/** Moves on after a session. "Too hard" repeats it; C25K "easy" twice in a row skips the 3rd day of the week. */
export function advance(p: ProgramState, feel: Feel): { state: ProgramState; message: string } {
  const weeks = programInfo(p.id).weeks
  const history = [...(p.history ?? []), { on: isoDate(), week: p.week, day: p.day, feel }].slice(-40)
  const easy = feel === 'easy' ? (p.easy_streak ?? 0) + 1 : 0
  const base = { ...p, history, last_on: isoDate(), easy_streak: easy }
  if (feel === 'hard') return { state: base, message: 'No problem. We’ll repeat this session next time. Progress isn’t a race 💚' }
  let { week, day } = p
  if (p.id === 'c25k' && easy >= 2 && day === 2) day = 3 // skip a repeat when it's clearly easy
  day += 1
  if (day > 3) { week += 1; day = 1 }
  if (week > weeks) return { state: { ...base, week: weeks, day: 3, done: true }, message: '🎉 Program complete! You did every week.' }
  const msg = day === 1 ? `Week ${p.week} done! On to week ${week}.` : feel === 'easy' && p.id === 'strength8' ? 'Felt easy: next time add a little weight.' : 'Nice work. Next session is ready.'
  return { state: { ...base, week, day }, message: msg }
}
