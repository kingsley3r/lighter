import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const show = useCallback((m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  )
}

export function Ring({ value, max, color, size = 150, stroke = 14, children }: { value: number; max: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="center">{children}</div>
    </div>
  )
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="bar"><div style={{ width: `${pct}%`, background: color }} /></div>
  )
}

export function Chips({ options, value, onChange }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.id)
        return (
          <button key={o.id} type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Seg<T extends string | number>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="tab" aria-selected={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function CheckBox({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={'check' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on} aria-label={label}>
      {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
    </button>
  )
}

/** Show `step` items at a time; resets when `resetKey` changes. */
export function useMore<T>(list: T[], step = 10, resetKey: unknown = null) {
  const [n, setN] = useState(step)
  useEffect(() => setN(step), [resetKey, step])
  return { shown: list.slice(0, n), left: Math.max(0, list.length - n), more: () => setN((x) => x + step), step }
}

export function ShowMore({ left, step = 10, onClick }: { left: number; step?: number; onClick: () => void }) {
  if (left <= 0) return null
  return <button className="btn ghost block show-more" onClick={onClick}>Show {Math.min(step, left)} more <span className="muted">({left} left)</span></button>
}
