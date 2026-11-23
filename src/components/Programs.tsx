import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { advance, applyStrength, checkBreak, describeRun, programInfo, PROGRAMS, runSession, startProgram, strengthScheme, type Feel, type ProgramId, type Segment } from '../lib/programs'
import type { PlannedWorkout, WorkoutPlan } from '../lib/types'
import { Bar, Sheet, useToast } from './ui'

/** Top card on Train: start a program, or see and start the next session. */
export function ProgramCard({ plan, strengthDone, onStrength, onBuildPlan, onLogged }: { plan: (WorkoutPlan & { id: number }) | null; strengthDone: number; onStrength: (w: PlannedWorkout) => void; onBuildPlan: () => Promise<boolean>; onLogged: () => void }) {
  const { profile, saveProfile } = useStore()
  const toast = useToast()
  const [pick, setPick] = useState(false)
  const [run, setRun] = useState(false)
  const [feel, setFeel] = useState<null | { title: string }>(null)
  const p = profile?.program ?? null

  // a program strength workout was just logged in the workout sheet
  useEffect(() => { if (strengthDone) setFeel({ title: 'Strength session' }) }, [strengthDone])

  // step back after a long break (once, when the card loads)
  useEffect(() => {
    if (!p) return
    const { state, steppedBack } = checkBreak(p)
    if (steppedBack) { saveProfile({ program: state }); toast(`Welcome back! We moved you to week ${state.week} to ease back in.`) }
  }, [p?.last_on]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return (
    <>
      <button className="card program-cta" onClick={() => setPick(true)}>
        <span style={{ fontSize: 26 }}>🎯</span>
        <div className="grow"><b>Follow a program</b><div className="small muted">Couch to 5K or 8-week strength. Adapts to how each session felt.</div></div>
        <span className="pill accent">Pick</span>
      </button>
      {pick && <ProgramPicker onClose={() => setPick(false)} onPick={async (id) => {
        if (id === 'strength8' && !(await onBuildPlan())) return
        await saveProfile({ program: startProgram(id) })
        setPick(false)
        toast(`${programInfo(id).title} started 🎉`)
      }} />}
    </>
  )

  const info = programInfo(p.id)
  const doneSessions = (p.week - 1) * 3 + (p.day - 1)
  const total = info.weeks * 3
  const strengthW = p.id === 'strength8' && plan?.workouts.length ? applyStrength(plan.workouts[(doneSessions) % plan.workouts.length], p.week, p.easy_streak) : null
  const segs = p.id === 'c25k' ? runSession(p.week, p.day) : null

  const finishFeel = async (f: Feel) => {
    const { state, message } = advance(p, f)
    await saveProfile({ program: state })
    setFeel(null)
    toast(message)
  }
  const quit = async () => { if (confirm(`Stop ${info.title}? Your logged workouts stay.`)) await saveProfile({ program: null }) }

  return (
    <section className="card program">
      <div className="card-head">
        <h2>{info.emoji} {info.title}</h2>
        <button className="link small" onClick={quit}>Stop</button>
      </div>
      {p.done ? (
        <p className="small" style={{ marginTop: 0 }}>🎉 You finished all {info.weeks} weeks! Start again, or pick the other program.</p>
      ) : (
        <>
          <div className="row between small"><b>Week {p.week} · Session {p.day} of 3</b><span className="muted">{doneSessions}/{total}</span></div>
          <Bar value={doneSessions} max={total} color="var(--accent)" />
          <p className="small muted" style={{ margin: '8px 0 10px' }}>
            {segs ? describeRun(segs) : `${strengthScheme(p.week).sets}×${strengthScheme(p.week).reps} · ${strengthScheme(p.week).note}`}
          </p>
          {segs && <button className="btn block" onClick={() => setRun(true)}>▶ Start run</button>}
          {p.id === 'strength8' && (strengthW ? <button className="btn block" onClick={() => onStrength(strengthW)}>▶ Start {strengthW.title.replace(/ · W\d+$/, '')}</button> : <button className="btn block" onClick={onBuildPlan}>Build my plan first</button>)}
        </>
      )}
      {p.done && <button className="btn block outline" onClick={() => setPick(true)}>Choose a program</button>}
      {pick && <ProgramPicker onClose={() => setPick(false)} onPick={async (id) => { if (id === 'strength8' && !(await onBuildPlan())) return; await saveProfile({ program: startProgram(id) }); setPick(false) }} />}
      {run && segs && <RunSheet title={`Couch to 5K · W${p.week}D${p.day}`} segs={segs} onClose={() => setRun(false)} onFinished={(t) => { setRun(false); onLogged(); setFeel({ title: t }) }} />}
      {feel && !p.done && <FeelSheet title={feel.title} onPick={finishFeel} onClose={() => setFeel(null)} />}
    </section>
  )
}

function ProgramPicker({ onPick, onClose }: { onPick: (id: ProgramId) => void; onClose: () => void }) {
  return (
    <Sheet title="Pick a program" onClose={onClose}>
      {PROGRAMS.map((p) => (
        <button key={p.id} className="card program-opt" onClick={() => onPick(p.id)}>
          <span style={{ fontSize: 30 }}>{p.emoji}</span>
          <div className="grow"><b>{p.title}</b> <span className="small muted">· {p.weeks} weeks</span><div className="small muted">{p.blurb}</div></div>
        </button>
      ))}
      <p className="small muted">After every session you tell Pip how it felt. Too hard? You repeat it. Too easy? It moves you on faster. Miss more than 10 days and it eases you back in. The strength program sets your weekly plan to 3 full-body days.</p>
    </Sheet>
  )
}

function FeelSheet({ title, onPick, onClose }: { title: string; onPick: (f: Feel) => void; onClose: () => void }) {
  return (
    <Sheet title="How did it feel?" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>{title}. Your answer sets the next session.</p>
      <div className="feel-opts">
        <button className="btn outline" onClick={() => onPick('easy')}>😎 Easy</button>
        <button className="btn" onClick={() => onPick('right')}>👍 Just right</button>
        <button className="btn outline" onClick={() => onPick('hard')}>🥵 Too hard</button>
      </div>
    </Sheet>
  )
}

const LABEL: Record<Segment['kind'], string> = { warm: 'Warm-up walk', run: 'Run', walk: 'Walk', cool: 'Cool-down walk' }
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function beep(times: number) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.3
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      o.start(t); o.stop(t + 0.25)
    }
    setTimeout(() => ctx.close(), times * 300 + 400)
  } catch { /* ignore */ }
  try { navigator.vibrate?.(times === 1 ? 300 : [200, 100, 200]) } catch { /* ignore */ }
}

/** Interval timer. Uses wall-clock time so it stays right if the phone sleeps. */
function RunSheet({ title, segs, onClose, onFinished }: { title: string; segs: Segment[]; onClose: () => void; onFinished: (title: string) => void }) {
  const toast = useToast()
  const total = segs.reduce((a, s) => a + s.s, 0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const base = useRef<{ start: number; before: number }>({ start: 0, before: 0 })
  const lastIdx = useRef(0)
  const lock = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => {
    if (!running) return
    base.current.start = Date.now()
    const t = setInterval(() => setElapsed(Math.min(total, base.current.before + (Date.now() - base.current.start) / 1000)), 250)
    ;(navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen').then((l) => { lock.current = l }).catch(() => {})
    return () => { clearInterval(t); base.current.before += (Date.now() - base.current.start) / 1000; lock.current?.release().catch(() => {}); lock.current = null }
  }, [running, total])

  let acc = 0, idx = 0
  for (; idx < segs.length; idx++) { if (elapsed < acc + segs[idx].s) break; acc += segs[idx].s }
  const done = elapsed >= total
  const cur = segs[Math.min(idx, segs.length - 1)]
  const left = done ? 0 : acc + cur.s - elapsed
  const next = segs[idx + 1]
  useEffect(() => {
    if (idx !== lastIdx.current) { lastIdx.current = idx; beep(done ? 3 : segs[idx]?.kind === 'run' ? 2 : 1) }
  }, [idx, done, segs])

  async function save() {
    const mins = Math.max(1, Math.round(elapsed / 60))
    const { error } = await supabase.from('workout_logs').insert({ title, duration_min: mins, kind: 'run', exercises: [] })
    if (error) return toast(error.message)
    toast('Run logged 🏃')
    onFinished(title)
  }

  return (
    <Sheet title={title} onClose={() => { if (elapsed < 30 || confirm('Leave the run? Progress is not saved.')) onClose() }}>
      <div className={`run-now ${done ? 'done' : cur.kind}`}>
        <div className="run-label">{done ? 'Done! 🎉' : LABEL[cur.kind]}</div>
        <div className="run-time num">{fmt(left)}</div>
        <div className="small">{done ? 'Great job. Save it below.' : next ? `Next: ${LABEL[next.kind]} ${fmt(next.s)}` : 'Last one!'}</div>
      </div>
      <div className="run-strip">
        {segs.map((s, i) => <span key={i} className={`${s.kind}${i < idx ? ' past' : ''}${i === idx && !done ? ' now' : ''}`} style={{ flex: s.s }} />)}
      </div>
      <div className="row between small muted" style={{ margin: '6px 0 14px' }}><span>{fmt(elapsed)}</span><span>{fmt(total)}</span></div>
      {done ? <button className="btn block" onClick={save}>Save run</button> : (
        <div className="row" style={{ gap: 8 }}>
          <button className="btn grow" onClick={() => { if (!running && elapsed === 0) beep(1); setRunning(!running) }}>{running ? '⏸ Pause' : elapsed ? '▶ Resume' : '▶ Start'}</button>
          {elapsed > 60 && <button className="btn outline" onClick={() => { setRunning(false); save() }}>Finish early</button>}
        </div>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>Beeps and buzzes when it’s time to switch. Keep the app open; the screen stays on. Run slow enough to talk.</p>
    </Sheet>
  )
}
