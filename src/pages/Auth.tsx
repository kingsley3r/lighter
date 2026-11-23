import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErr(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      if (error) setErr(error.message)
      else if (!data.session) {
        setMsg('Almost done! Open the confirmation email, tap the link, then come back here and sign in.')
        setMode('in')
      }
    }
    setBusy(false)
  }

  async function reset() {
    if (!email) return setErr('Enter your email first.')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setErr(error.message)
    else setMsg('Check your inbox for a reset link.')
  }

  return (
    <div className="auth">
      <img src="/favicon.svg" className="logo" alt="" />
      <h1 style={{ margin: '0 0 4px', fontSize: 32, letterSpacing: '-0.02em' }}>Lighter</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 24 }}>Your weight-loss journey, one day at a time.</p>
      <form onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {err && <p style={{ color: 'var(--warn)' }} className="small">{err}</p>}
        {msg && <p className="small" style={{ background: 'var(--accent-soft)', padding: 12, borderRadius: 12 }}>{msg}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      </form>
      <div className="row between" style={{ marginTop: 16 }}>
        <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(null) }}>
          {mode === 'in' ? 'Create an account' : 'I already have an account'}
        </button>
        {mode === 'in' && <button className="link" style={{ color: 'var(--muted)' }} onClick={reset}>Forgot password?</button>}
      </div>
    </div>
  )
}
