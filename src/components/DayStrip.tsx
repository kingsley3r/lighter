import { addDays, isoDate, startOfWeek, WEEKDAYS } from '../lib/dates'

/** Week strip with prev/next week arrows. `marks` = ISO dates that get a dot. */
export default function DayStrip({ date, onChange, marks, planned }: { date: Date; onChange: (d: Date) => void; marks?: Set<string>; planned?: Set<string> }) {
  const ws = startOfWeek(date)
  const today = isoDate()
  return (
    <div className="day-strip">
      <button onClick={() => onChange(addDays(date, -7))} aria-label="Previous week" style={{ flex: '0 0 26px' }}>‹</button>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i)
        const iso = isoDate(d)
        const on = iso === isoDate(date)
        return (
          <button key={i} className={`${on ? 'on' : ''}${iso === today ? ' is-today' : ''}${planned?.has(iso) ? ' planned' : ''}`} onClick={() => onChange(d)}>
            {WEEKDAYS[i]}
            <b>{d.getDate()}</b>
            {marks?.has(iso) ? <span className="dot" /> : <span style={{ height: 7 }} />}
          </button>
        )
      })}
      <button onClick={() => onChange(addDays(date, 7))} aria-label="Next week" style={{ flex: '0 0 26px' }}>›</button>
    </div>
  )
}
