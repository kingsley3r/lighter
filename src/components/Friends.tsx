import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { fmtShort, parseDate } from '../lib/dates'
import type { Outfit } from '../lib/outfits'
import { PetFigure } from './Pet'
import { Seg, Sheet, useToast } from './ui'

export interface Friend { friendship_id: number; user_id: string; status: 'pending' | 'accepted'; incoming: boolean; name: string; pip_name: string; pip_level: number | null; outfit: Outfit | null; steps_today: number | null; steps_week: number | null }
interface Challenge { id: number; title: string; kind: Kind; start_day: string; end_day: string; owner: string }
interface Row { user_id: string; name: string; pip_level: number; outfit: Outfit; value: number; is_me: boolean }
type Kind = 'steps' | 'distance' | 'workouts'

const KIND: Record<Kind, { label: string; unit: string; icon: string }> = {
  steps: { label: 'Steps', unit: 'steps', icon: '👣' },
  distance: { label: 'Distance', unit: 'km', icon: '🏃' },
  workouts: { label: 'Workouts', unit: 'workouts', icon: '🏋️' },
}
const CHEERS = ['💪', '🔥', '💚', '👏', '🍎']
const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-US')

async function friends(): Promise<Friend[]> {
  const { data } = await supabase.rpc('friend_list')
  return (data ?? []) as Friend[]
}
async function challenges(): Promise<Challenge[]> {
  const { data } = await supabase.from('challenges').select('*').order('end_day', { ascending: false })
  return (data ?? []) as Challenge[]
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const daysLeft = (c: Challenge) => Math.round((parseDate(c.end_day).getTime() - parseDate(today()).getTime()) / 864e5) + 1

/** Small card on Today: unseen cheers and your rank in the current challenge. */
export function FriendsCard({ onOpen }: { onOpen: () => void }) {
  const { version } = useStore()
  const [cheers, setCheers] = useState<{ id: number; emoji: string; name: string }[]>([])
  const [top, setTop] = useState<{ c: Challenge; rows: Row[] } | null>(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: s } = await supabase.auth.getSession()
      const me = s.session?.user.id
      const [{ data: ch }, list, fl] = await Promise.all([
        supabase.from('cheers').select('id,emoji,from_user').eq('to_user', me ?? '').eq('seen', false).order('created_at', { ascending: false }).limit(10),
        challenges(),
        friends(),
      ])
      const names = new Map(fl.map((f) => [f.user_id, f.name]))
      if (!live) return
      setCheers((ch ?? []).map((c) => ({ id: c.id, emoji: c.emoji, name: names.get(c.from_user) ?? 'A friend' })))
      const active = list.find((c) => c.end_day >= today())
      if (active) {
        const { data } = await supabase.rpc('challenge_board', { cid: active.id })
        if (live) setTop({ c: active, rows: (data ?? []) as Row[] })
      } else setTop(null)
    })()
    return () => { live = false }
  }, [version])

  async function dismiss() {
    const ids = cheers.map((c) => c.id)
    setCheers([])
    await supabase.from('cheers').update({ seen: true }).in('id', ids)
  }
  if (!cheers.length && !top) return null
  const meIdx = top ? top.rows.findIndex((r) => r.is_me) : -1
  return (
    <section className="card">
      {cheers.length > 0 && (
        <div className="cheer-banner">
          <span className="cheer-emojis">{cheers.slice(0, 3).map((c) => c.emoji).join('')}</span>
          <span className="grow small"><b>{[...new Set(cheers.map((c) => c.name))].slice(0, 2).join(' & ')}</b> cheered you on!</span>
          <button className="btn ghost sm" onClick={dismiss}>Thanks</button>
        </div>
      )}
      {top && (
        <button className="fr-mini" onClick={onOpen}>
          <span style={{ fontSize: 22 }}>{KIND[top.c.kind].icon}</span>
          <span className="grow">
            <b>{top.c.title}</b>
            <span className="small muted">{meIdx === 0 ? 'You’re in the lead 🥇' : meIdx > 0 ? `You’re #${meIdx + 1}, ${fmt(Math.ceil(top.rows[0].value - top.rows[meIdx].value))} ${KIND[top.c.kind].unit} behind ${top.rows[0].name}` : ''} · {daysLeft(top.c) > 0 ? `${daysLeft(top.c)} days left` : 'ends today'}</span>
          </span>
          <span className="muted">›</span>
        </button>
      )}
    </section>
  )
}

export default function FriendsSheet({ onClose, invite }: { onClose: () => void; invite?: string | null }) {
  const toast = useToast()
  const [code, setCode] = useState<string | null>(null)
  const [list, setList] = useState<Friend[] | null>(null)
  const [chs, setChs] = useState<Challenge[]>([])
  const [input, setInput] = useState(invite ?? '')
  const [view, setView] = useState<null | 'new' | Challenge>(null)
  const load = useCallback(async () => { const [f, c] = await Promise.all([friends(), challenges()]); setList(f); setChs(c) }, [])
  useEffect(() => {
    supabase.rpc('my_friend_code').then(({ data }) => setCode((data as string) ?? null))
    load()
  }, [load])

  async function add(c = input) {
    const v = c.trim().toUpperCase()
    if (v.length < 4) return
    const { data, error } = await supabase.rpc('add_friend', { friend_code: v })
    if (error) return toast(error.message)
    const msg: Record<string, string> = { requested: 'Request sent. You’ll be friends once they accept.', accepted: 'You’re now friends! 🎉', already: 'You’re already friends.', pending: 'Request already sent.', not_found: 'No one has this code. Check it and try again.', self: 'That’s your own code 😄' }
    toast(msg[data as string] ?? 'Done')
    setInput('')
    load()
  }
  useEffect(() => { if (invite) add(invite) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite])

  async function share() {
    if (!code) return
    const url = `https://lighter-sigma.vercel.app/?friend=${code}`
    const text = `Join me on Lighter! Add me with code ${code}: ${url}`
    try { if (navigator.share) await navigator.share({ title: 'Lighter', text }); else { await navigator.clipboard.writeText(text); toast('Invite copied') } } catch { /* cancelled */ }
  }
  async function accept(f: Friend) { await supabase.rpc('accept_friend', { fid: f.friendship_id }); toast(`You and ${f.name} are friends now 🎉`); load() }
  async function remove(f: Friend) {
    if (!confirm(f.status === 'accepted' ? `Remove ${f.name} from your friends?` : 'Cancel this request?')) return
    await supabase.from('friendships').delete().eq('id', f.friendship_id)
    load()
  }
  async function cheer(f: Friend, emoji: string) {
    const { error } = await supabase.from('cheers').insert({ to_user: f.user_id, emoji })
    toast(error ? error.message : `Sent ${emoji} to ${f.name}`)
  }

  if (view === 'new') return <NewChallenge friends={(list ?? []).filter((f) => f.status === 'accepted')} onClose={() => setView(null)} onCreated={(c) => { load(); setView(c) }} />
  if (view) return <Board c={view} onClose={() => { setView(null); load() }} />

  const accepted = (list ?? []).filter((f) => f.status === 'accepted')
  const incoming = (list ?? []).filter((f) => f.status === 'pending' && f.incoming)
  const outgoing = (list ?? []).filter((f) => f.status === 'pending' && !f.incoming)

  return (
    <Sheet title="Friends" onClose={onClose}>
      <div className="fr-code">
        <div><span className="small muted">Your friend code</span><b className="num">{code ?? '······'}</b></div>
        <button className="btn sm" onClick={share} disabled={!code}>Invite</button>
      </div>
      <form className="row" style={{ gap: 8, margin: '10px 0 16px' }} onSubmit={(e) => { e.preventDefault(); add() }}>
        <input className="input grow" value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="Friend’s code" maxLength={8} autoCapitalize="characters" />
        <button className="btn sm" disabled={input.trim().length < 4}>Add</button>
      </form>

      {incoming.map((f) => (
        <div key={f.friendship_id} className="fr-req">
          <span className="grow"><b>{f.name}</b> wants to be friends</span>
          <button className="btn sm" onClick={() => accept(f)}>Accept</button>
          <button className="btn ghost sm" onClick={() => remove(f)}>✕</button>
        </div>
      ))}

      <h3 className="row between" style={{ margin: '8px 0', fontSize: 15 }}><span>Challenges</span>{accepted.length > 0 && <button className="link" onClick={() => setView('new')}>+ New</button>}</h3>
      {chs.length === 0 ? <p className="small muted" style={{ marginTop: 0 }}>{accepted.length ? 'Start a steps, distance or workout challenge with your friends.' : 'Add a friend first, then challenge them.'}</p> : (
        <div className="fr-chs">
          {chs.map((c) => (
            <button key={c.id} className="fr-mini" onClick={() => setView(c)}>
              <span style={{ fontSize: 22 }}>{KIND[c.kind].icon}</span>
              <span className="grow"><b>{c.title}</b><span className="small muted">{fmtShort(parseDate(c.start_day))} – {fmtShort(parseDate(c.end_day))}{c.end_day >= today() ? ` · ${daysLeft(c)} days left` : ' · finished'}</span></span>
              <span className="muted">›</span>
            </button>
          ))}
        </div>
      )}

      <h3 style={{ margin: '16px 0 8px', fontSize: 15 }}>Your friends</h3>
      {list === null ? <div className="small muted">Loading…</div> : accepted.length === 0 ? (
        <p className="small muted" style={{ marginTop: 0 }}>No friends yet. Tap Invite and send your code. Friends see your name, your Pip and your steps, never your food or weight.</p>
      ) : accepted.map((f) => (
        <div key={f.friendship_id} className="fr-row">
          <div className="fr-pip"><PetFigure mood="happy" level={f.pip_level ?? 1} eating={false} size={58} outfit={f.outfit ?? undefined} stage={0} /></div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row between"><b>{f.name}</b><button className="link small" onClick={() => remove(f)} aria-label={`Remove ${f.name}`}>⋯</button></div>
            <div className="small muted">{f.pip_name} · Lv {f.pip_level ?? 1} · 👣 {fmt(f.steps_today)} today · {fmt(f.steps_week)} this week</div>
            <div className="fr-cheers">{CHEERS.map((e) => <button key={e} onClick={() => cheer(f, e)} aria-label={`Send ${e}`}>{e}</button>)}</div>
          </div>
        </div>
      ))}
      {outgoing.length > 0 && <p className="small muted">Waiting for: {outgoing.map((f) => f.name).join(', ')}</p>}
      <p className="small muted" style={{ textAlign: 'center' }}>🔒 Friends never see your food, weight or photos.</p>
    </Sheet>
  )
}

function NewChallenge({ friends, onClose, onCreated }: { friends: Friend[]; onClose: () => void; onCreated: (c: Challenge) => void }) {
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('steps')
  const [days, setDays] = useState<7 | 14 | 30>(7)
  const [pick, setPick] = useState<string[]>(friends.map((f) => f.user_id))
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const auto = `${days}-day ${KIND[kind].label.toLowerCase()} battle`
  async function create() {
    if (!pick.length) return toast('Pick at least one friend')
    setBusy(true)
    const { data, error } = await supabase.rpc('create_challenge', { title: title.trim() || auto[0].toUpperCase() + auto.slice(1), kind, days, friend_ids: pick })
    setBusy(false)
    if (error) return toast(error.message)
    const { data: c } = await supabase.from('challenges').select('*').eq('id', data as number).single()
    toast('Challenge started! 🏁')
    onCreated(c as Challenge)
  }
  return (
    <Sheet title="New challenge" onClose={onClose}>
      <label className="field"><span>What counts</span><Seg options={(Object.keys(KIND) as Kind[]).map((k) => ({ id: k, label: `${KIND[k].icon} ${KIND[k].label}` }))} value={kind} onChange={setKind} /></label>
      <label className="field"><span>How long</span><Seg<7 | 14 | 30> options={[{ id: 7, label: '1 week' }, { id: 14, label: '2 weeks' }, { id: 30, label: '30 days' }]} value={days} onChange={setDays} /></label>
      <label className="field"><span>Name (optional)</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={auto[0].toUpperCase() + auto.slice(1)} maxLength={60} /></label>
      <div className="field"><span>With</span>
        <div className="chips">{friends.map((f) => {
          const on = pick.includes(f.user_id)
          return <button key={f.user_id} className={`chip${on ? ' on' : ''}`} onClick={() => setPick(on ? pick.filter((x) => x !== f.user_id) : [...pick, f.user_id])}>{on ? '✓ ' : ''}{f.name}</button>
        })}</div>
      </div>
      <p className="small muted">{kind === 'steps' ? 'Counts steps from Apple Health or entered by hand.' : kind === 'distance' ? 'Counts kilometres from tracked runs, walks and rides.' : 'Counts finished workouts.'} Starts today.</p>
      <button className="btn block" disabled={busy} onClick={create}>{busy ? 'Starting…' : 'Start challenge'}</button>
    </Sheet>
  )
}

function Board({ c, onClose }: { c: Challenge; onClose: () => void }) {
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [me, setMe] = useState<string | null>(null)
  useEffect(() => {
    supabase.rpc('challenge_board', { cid: c.id }).then(({ data }) => setRows((data ?? []) as Row[]))
    supabase.auth.getSession().then(({ data }) => setMe(data.session?.user.id ?? null))
  }, [c.id])
  const max = Math.max(1, ...(rows ?? []).map((r) => Number(r.value)))
  const done = c.end_day < today()
  async function leave() {
    if (!confirm(c.owner === me ? 'Delete this challenge for everyone?' : 'Leave this challenge?')) return
    if (c.owner === me) await supabase.from('challenges').delete().eq('id', c.id)
    else await supabase.from('challenge_members').delete().eq('challenge_id', c.id).eq('user_id', me ?? '')
    toast('Done')
    onClose()
  }
  return (
    <Sheet title={c.title} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>{KIND[c.kind].icon} {KIND[c.kind].label} · {fmtShort(parseDate(c.start_day))} – {fmtShort(parseDate(c.end_day))} · {done ? 'finished' : `${daysLeft(c)} days left`}</p>
      {rows === null ? <div className="empty">Loading…</div> : (
        <div className="board">
          {rows.map((r, i) => (
            <div key={r.user_id} className={`board-row${r.is_me ? ' me' : ''}`}>
              <span className="board-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
              <div className="board-pip"><PetFigure mood={i === 0 ? 'happy' : 'content'} level={r.pip_level} eating={false} flex={i === 0} size={44} outfit={r.outfit} stage={0} /></div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row between"><b>{r.is_me ? 'You' : r.name}</b><span className="num small">{fmt(Number(r.value))} {KIND[c.kind].unit}</span></div>
                <div className="board-bar"><i style={{ width: `${(Number(r.value) / max) * 100}%` }} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
      {done && rows?.[0] && <p style={{ textAlign: 'center', fontWeight: 700 }}>🏆 {rows[0].is_me ? 'You won!' : `${rows[0].name} won!`}</p>}
      <button className="btn ghost block" style={{ marginTop: 12 }} onClick={leave}>{c.owner === me ? 'Delete challenge' : 'Leave challenge'}</button>
    </Sheet>
  )
}
