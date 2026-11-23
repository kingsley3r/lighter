import { Sheet } from './ui'
import RouteMap from './RouteMap'
import { fmtDuration, fmtKm, fmtPace, SPORTS } from '../lib/geo'
import type { WorkoutLog } from '../lib/types'
import { supabase } from '../lib/supabase'

export default function ActivityDetail({ a, onClose, onDeleted }: { a: WorkoutLog; onClose: () => void; onDeleted: () => void }) {
  const sp = SPORTS.find((s) => s.id === a.kind)
  const secs = a.duration_s ?? (a.duration_min ?? 0) * 60
  const km = (a.distance_m ?? 0) / 1000
  const splits = a.splits ?? []
  const fastest = splits.length ? Math.min(...splits) : 0
  const slowest = splits.length ? Math.max(...splits) : 0
  const del = async () => {
    if (!confirm('Delete this activity?')) return
    await supabase.from('workout_logs').delete().eq('id', a.id)
    onDeleted()
  }
  return (
    <Sheet title={a.title} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>{new Date(a.done_at).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
      {a.route && a.route.length > 1 && <RouteMap route={a.route} height={240} />}
      <div className="grid3" style={{ marginTop: 12 }}>
        <div className="stat-tile"><div className="v num">{km.toFixed(2)}</div><div className="l">km</div></div>
        <div className="stat-tile"><div className="v num">{fmtDuration(secs)}</div><div className="l">time</div></div>
        <div className="stat-tile"><div className="v num">{sp && !sp.pace ? (km / (secs / 3600 || 1)).toFixed(1) : fmtPace(km ? secs / km : NaN)}</div><div className="l">{sp && !sp.pace ? 'km/h' : 'avg pace /km'}</div></div>
        <div className="stat-tile"><div className="v num">{a.elevation_gain_m ?? 0} m</div><div className="l">elevation gain</div></div>
        <div className="stat-tile"><div className="v num">{a.kcal ?? '–'}</div><div className="l">kcal burned (est.)</div></div>
        <div className="stat-tile"><div className="v num">{splits.length ? fmtPace(fastest) : '–'}</div><div className="l">fastest km</div></div>
      </div>
      {splits.length > 0 && (
        <section className="card" style={{ marginTop: 12 }}>
          <h2>Splits</h2>
          {splits.map((s, i) => (
            <div key={i} className="split-row">
              <span className="small muted num">km {i + 1}</span>
              <div className="split-bar"><div style={{ width: `${(fastest / s) * 100}%`, background: s === fastest ? 'var(--accent)' : 'var(--water)' }} /></div>
              <span className="num small" style={{ fontWeight: s === fastest ? 700 : 500 }}>{fmtPace(s)}</span>
            </div>
          ))}
          {splits.length > 1 && <p className="small muted" style={{ marginBottom: 0 }}>Spread fastest to slowest: {fmtDuration(slowest - fastest)} per km.</p>}
        </section>
      )}
      <button className="btn danger block" style={{ marginTop: 12 }} onClick={del}>Delete activity</button>
    </Sheet>
  )
}

export { fmtKm }
