import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readLocalOutfit } from '../lib/outfits'
import { PetFigure } from './Pet'
import { Sheet } from './ui'

interface Msg { role: 'user' | 'assistant'; content: string; error?: boolean }
const KEY = 'coach-chat'
const IDEAS = [
  'What should I eat tonight with the calories I have left?',
  'How am I doing this week?',
  'Give me a high-protein snack idea',
  'Why isn’t my weight going down?',
  'Quick workout I can do at home in 20 min?',
]

function load(): Msg[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
function save(m: Msg[]) { try { localStorage.setItem(KEY, JSON.stringify(m.filter((x) => !x.error).slice(-30))) } catch { /* ignore */ } }

/** Renders **bold** and line breaks without HTML injection. */
function Text({ s }: { s: string }) {
  return <>{s.split('\n').map((line, i) => (
    <p key={i}>{line.split(/(\*\*[^*]+\*\*)/g).map((part, k) => part.startsWith('**') && part.endsWith('**') ? <b key={k}>{part.slice(2, -2)}</b> : part.replace(/^[-*] /, '• '))}</p>
  ))}</>
}

export default function Coach({ onClose, name = 'Pip', level = 4 }: { onClose: () => void; name?: string; level?: number }) {
  const [msgs, setMsgs] = useState<Msg[]>(load)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  async function send(q = text) {
    const t = q.trim()
    if (!t || busy) return
    const next: Msg[] = [...msgs.filter((m) => !m.error), { role: 'user', content: t }]
    setMsgs(next); setText(''); setBusy(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error || 'Pip couldn’t answer right now.')
      const done: Msg[] = [...next, { role: 'assistant', content: body.reply }]
      setMsgs(done); save(done)
    } catch (e) {
      setMsgs([...next, { role: 'assistant', content: (e as Error).message, error: true }])
    }
    setBusy(false)
  }

  return (
    <Sheet title={`Ask ${name}`} onClose={onClose}>
      <div className="coach">
        {msgs.length === 0 && (
          <div className="coach-hello">
            <PetFigure mood="happy" level={level} eating={false} flex size={96} outfit={readLocalOutfit()} />
            <p>Hi! I can see what you ate, your weight trend, steps and workouts. Ask me anything 🌱</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}${m.error ? ' err' : ''}`}><Text s={m.content} /></div>
        ))}
        {busy && <div className="bubble assistant typing"><i /><i /><i /></div>}
        <div ref={end} />
      </div>
      {!busy && (msgs.length === 0 || msgs[msgs.length - 1].role === 'assistant') && (
        <div className="chips scroll coach-ideas">
          {IDEAS.filter((q) => !msgs.some((m) => m.content === q)).slice(0, msgs.length ? 3 : 5).map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}
        </div>
      )}
      <form className="coach-input" onSubmit={(e) => { e.preventDefault(); send() }}>
        <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${name}…`} enterKeyHint="send" />
        <button className="btn" disabled={busy || !text.trim()} aria-label="Send">➤</button>
      </form>
      <div className="row between small muted" style={{ marginTop: 6 }}>
        <span>Each question uses one of your daily AI requests.</span>
        {msgs.length > 0 && <button className="link small" onClick={() => { setMsgs([]); save([]) }}>Clear</button>}
      </div>
    </Sheet>
  )
}
