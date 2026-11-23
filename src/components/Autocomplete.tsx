import { useState, type ReactNode } from 'react'

export interface Suggestion { key: string; label: ReactNode; sub?: ReactNode; right?: ReactNode; onPick: () => void }

/** Text input with a dropdown of suggestions under it. `suggest` gets the current text and returns the options. */
export default function Autocomplete({
  value,
  onChange,
  suggest,
  placeholder,
  autoFocus,
  multiline,
  className = 'input',
}: {
  value: string
  onChange: (v: string) => void
  suggest: (v: string) => Suggestion[]
  placeholder?: string
  autoFocus?: boolean
  multiline?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(!!autoFocus)
  const [active, setActive] = useState(0)
  const items = open ? suggest(value) : []
  const pick = (s: Suggestion) => {
    s.onPick()
    setOpen(false)
  }
  const props = {
    className,
    value,
    placeholder,
    autoFocus,
    autoComplete: 'off',
    onChange: (e: { target: { value: string } }) => {
      onChange(e.target.value)
      setOpen(true)
      setActive(0)
    },
    onFocus: () => setOpen(true),
    onBlur: () => window.setTimeout(() => setOpen(false), 150),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!items.length) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length) }
      else if (e.key === 'Enter' && !multiline) { e.preventDefault(); pick(items[active]) }
      else if (e.key === 'Escape') setOpen(false)
    },
    role: 'combobox',
    'aria-expanded': items.length > 0,
  }
  return (
    <div className="ac">
      {multiline ? <textarea {...props} /> : <input {...props} />}
      {items.length > 0 && (
        <div className="ac-list" role="listbox">
          {items.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="option"
              aria-selected={i === active}
              className={'ac-item' + (i === active ? ' on' : '')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              <div className="grow">
                <div className="ac-label">{s.label}</div>
                {s.sub && <div className="small muted">{s.sub}</div>}
              </div>
              {s.right && <div className="small num muted">{s.right}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const kcalRight = (kcal: number) => `${Math.round(kcal)} kcal`
