import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { addDays, fmtTime, isoDate } from '../lib/dates'
import { setSteps, stepKcal, stepsOn, type StepLog } from '../lib/steps'
import { Bar, Seg, Sheet, useToast } from './ui'

export function StepsCard({ onHealth }: { onHealth: () => void }) {
  const { profile, version, bump } = useStore()
  const [log, setLog] = useState<StepLog | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  useEffect(() => { stepsOn().then(setLog) }, [version])
  if (!profile || log === undefined) return null
  const goal = profile.step_target ?? 8000
  const n = log?.steps ?? 0
  return (
    <section className="card">
      <button className="steps-card" onClick={() => setOpen(true)}>
        <div className="card-head" style={{ marginBottom: 8 }}>
          <h2>👣 Steps</h2>
          <span className="num muted small">{n.toLocaleString('en-US')} / {goal.toLocaleString('en-US')}</span>
        </div>
        <Bar value={n} max={goal} color="var(--accent)" />
        <div className="small muted" style={{ marginTop: 8 }}>
          {log ? `${n >= goal ? 'Goal reached 🎉 · ' : ''}~${stepKcal(n)} kcal burned · ${log.source === 'apple_health' ? `from Apple Health, ${fmtTime(log.updated_at)}` : 'entered by you'}` : 'Tap to add steps, or connect Apple Health.'}
        </div>
      </button>
      {open && <StepsSheet current={n} onClose={() => setOpen(false)} onSaved={() => { stepsOn().then(setLog); bump() }} onHealth={() => { setOpen(false); onHealth() }} />}
    </section>
  )
}

function StepsSheet({ current, onClose, onSaved, onHealth }: { current: number; onClose: () => void; onSaved: () => void; onHealth: () => void }) {
  const toast = useToast()
  const { profile, saveProfile } = useStore()
  const [day, setDay] = useState<'today' | 'yesterday'>('today')
  const [v, setV] = useState(current ? String(current) : '')
  const [goal, setGoal] = useState(String(profile?.step_target ?? 8000))
  async function save() {
    const n = Number(v.replace(/[^\d]/g, ''))
    if (!(n >= 0 && n < 200000)) return toast('Please enter a number of steps')
    const { error } = await setSteps(isoDate(day === 'today' ? new Date() : addDays(new Date(), -1)), n)
    if (error) return toast(error.message)
    const g = Number(goal.replace(/[^\d]/g, ''))
    if (g >= 1000 && g <= 50000 && g !== profile?.step_target) await saveProfile({ step_target: g })
    toast('Steps saved ✓')
    onSaved()
    onClose()
  }
  return (
    <Sheet title="Steps" onClose={onClose}>
      <button className="health-cta" onClick={onHealth}>
        <span className="health-heart">❤️</span>
        <span className="grow"><b>Sync from Apple Health</b><span className="small muted">Steps arrive automatically every evening</span></span>
        <span className="muted">›</span>
      </button>
      <Seg options={[{ id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }]} value={day} onChange={setDay} />
      <label className="field" style={{ marginTop: 14 }}><span>Steps</span>
        <input className="input num" inputMode="numeric" placeholder="e.g. 7500" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <label className="field"><span>Daily goal</span>
        <input className="input num" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      <button className="btn block" onClick={save}>Save</button>
    </Sheet>
  )
}

const ENDPOINT = 'https://lighter-sigma.vercel.app/api/health'

export function HealthSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [info, setInfo] = useState<{ created_at: string; last_used_at: string | null; last_payload: { steps?: number; weight_kg?: number } | null } | null | undefined>(undefined)
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => supabase.from('health_tokens').select('created_at,last_used_at,last_payload').maybeSingle().then(({ data }) => setInfo(data ?? null))
  useEffect(() => { load() }, [])

  async function create() {
    if (info && !confirm('Make a new key? The old one stops working, so you’ll need to paste the new one into your shortcut.')) return
    setBusy(true)
    const { data, error } = await supabase.rpc('create_health_token')
    setBusy(false)
    if (error) return toast(error.message)
    setToken(data as string)
    load()
  }
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied`) } catch { toast('Copy failed. Long-press to select it.') }
  }
  async function disconnect() {
    if (!confirm('Disconnect Apple Health? Your shortcut will stop syncing.')) return
    await supabase.from('health_tokens').delete().not('user_id', 'is', null)
    setToken(null)
    load()
  }

  return (
    <Sheet title="Apple Health" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Web apps can’t read Apple Health directly. The free Shortcuts app on your iPhone can, and sends your steps (and weight, if you like) to Lighter every evening. You set it up once, which takes about 3 minutes.
      </p>

      {info?.last_used_at && (
        <div className="weekly-prev ok" style={{ marginBottom: 12 }}>
          <span>✅</span>
          <span className="grow small">Last sync {new Date(info.last_used_at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
            {info.last_payload?.steps != null ? ` · ${info.last_payload.steps.toLocaleString('en-US')} steps` : ''}{info.last_payload?.weight_kg != null ? ` · ${info.last_payload.weight_kg} kg` : ''}</span>
        </div>
      )}

      <ol className="health-steps">
        <li>
          <b>Get your personal key</b>
          {token ? (
            <div className="health-key">
              <code>{token}</code>
              <button className="btn sm" onClick={() => copy(token, 'Key')}>Copy</button>
              <span className="small muted">Shown only once. Keep it private, it lets the shortcut save data to your account.</span>
            </div>
          ) : (
            <button className="btn sm" style={{ marginTop: 6 }} disabled={busy} onClick={create}>{info ? 'Make a new key' : 'Create key'}</button>
          )}
          {info && !token && <div className="small muted">You already have a key ({new Date(info.created_at).toLocaleDateString('en-GB')}). Make a new one only if you lost it.</div>}
        </li>
        <li>Open <b>Shortcuts</b> → <b>Automation</b> → <b>+</b> → <b>Time of Day</b>. Pick <b>21:00</b>, <b>Daily</b>, and <b>Run Immediately</b>. Tap <b>Next</b> → <b>New Blank Automation</b>.</li>
        <li>Add <b>Find Health Samples</b>: Type <b>Steps</b>, filter <b>Start Date is Today</b>.</li>
        <li>Add <b>Calculate Statistics</b>: <b>Sum</b> of Health Samples.</li>
        <li><i>Optional, for weight:</i> add another <b>Find Health Samples</b>: Type <b>Weight</b>, sort by <b>Start Date</b>, <b>Latest First</b>, <b>Limit 1</b>.</li>
        <li>
          Add <b>Get Contents of URL</b> and paste this address:
          <div className="health-key"><code>{ENDPOINT}</code><button className="btn sm ghost" onClick={() => copy(ENDPOINT, 'Address')}>Copy</button></div>
          Tap the arrow to show more:
          <ul>
            <li>Method: <b>POST</b></li>
            <li>Headers: add <b>Authorization</b> with the value <b>Bearer</b>, a space, then your key</li>
            <li>Request Body: <b>JSON</b>. Add a <b>Number</b> field <b>steps</b> → pick <b>Statistics</b>. For weight, add a <b>Number</b> field <b>weight</b> → pick the weight <b>Health Samples</b>.</li>
          </ul>
        </li>
        <li>Tap <b>▶</b> to test it once. Allow access to Health when asked. Your steps then show up on Today.</li>
      </ol>
      <p className="small muted">Tip: add a second automation at 13:00 if you want steps to show up during the day too.</p>
      {info && <button className="btn ghost block" onClick={disconnect}>Disconnect</button>}
    </Sheet>
  )
}
