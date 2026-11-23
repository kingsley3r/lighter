import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useToast } from './ui'
import RouteMap from './RouteMap'
import { fmtDuration, fmtKm, fmtPace, SPORTS, thin, trackStats, type GeoPoint } from '../lib/geo'
import { latestWeight } from '../lib/data'
import { supabase } from '../lib/supabase'

type Phase = 'ready' | 'running' | 'paused'
interface Saved { sport: string; segments: GeoPoint[][]; elapsed: number; startedAt: number; resumedAt: number | null }
const KEY = 'active-activity'

const load = (): Saved | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}

export default function Tracker({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const { profile } = useStore()
  const toast = useToast()
  const saved = useRef(load())
  const [sport, setSport] = useState(saved.current?.sport ?? 'run')
  const [phase, setPhase] = useState<Phase>(saved.current ? 'paused' : 'ready')
  const [segments, setSegments] = useState<GeoPoint[][]>(saved.current?.segments ?? [])
  const [elapsedBase, setElapsedBase] = useState(saved.current?.elapsed ?? 0)
  const [resumedAt, setResumedAt] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<number>(saved.current?.startedAt ?? 0)
  const [now, setNow] = useState(Date.now())
  const [here, setHere] = useState<[number, number] | null>(null)
  const [gps, setGps] = useState<'searching' | 'good' | 'weak' | 'denied'>('searching')
  const [busy, setBusy] = useState(false)
  const watch = useRef<number | null>(null)
  const lock = useRef<{ release: () => Promise<void> } | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Persist so an accidental reload doesn't lose the activity
  useEffect(() => {
    if (phase === 'ready') return
    try {
      localStorage.setItem(KEY, JSON.stringify({ sport, segments, elapsed: elapsedBase + (resumedAt ? (Date.now() - resumedAt) / 1000 : 0), startedAt, resumedAt: null }))
    } catch {
      /* ignore */
    }
  }, [segments, phase, sport, elapsedBase, resumedAt, startedAt])

  const onPos = useCallback((p: GeolocationPosition) => {
    const acc = p.coords.accuracy
    setGps(acc <= 25 ? 'good' : 'weak')
    setHere([p.coords.latitude, p.coords.longitude])
    if (phaseRef.current !== 'running' || acc > 35) return
    const pt: GeoPoint = { lat: p.coords.latitude, lng: p.coords.longitude, t: p.timestamp || Date.now(), alt: p.coords.altitude, acc }
    setSegments((segs) => {
      const s = segs.length ? segs : [[]]
      const cur = s[s.length - 1]
      const prev = cur[cur.length - 1]
      if (prev) {
        const dt = (pt.t - prev.t) / 1000
        const R = 6371000
        const d = Math.hypot((pt.lat - prev.lat) * (Math.PI / 180) * R, (pt.lng - prev.lng) * (Math.PI / 180) * R * Math.cos((pt.lat * Math.PI) / 180))
        if (d < 3 || dt <= 0 || d / dt > 25) return segs // jitter or GPS jump
      }
      return [...s.slice(0, -1), [...cur, pt]]
    })
  }, [])

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGps('denied')
      return
    }
    watch.current = navigator.geolocation.watchPosition(onPos, (e) => setGps(e.code === 1 ? 'denied' : 'weak'), { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 })
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
    }
  }, [onPos])

  useEffect(() => {
    if (phase !== 'running') return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [phase])

  const keepAwake = async (on: boolean) => {
    try {
      if (on && 'wakeLock' in navigator) lock.current = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen')
      if (!on) {
        await lock.current?.release()
        lock.current = null
      }
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    const vis = () => {
      if (document.visibilityState === 'visible' && phaseRef.current === 'running') keepAwake(true)
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      document.removeEventListener('visibilitychange', vis)
      keepAwake(false)
    }
  }, [])

  const elapsed = elapsedBase + (phase === 'running' && resumedAt ? (now - resumedAt) / 1000 : 0)
  const stats = trackStats(segments)
  const sp = SPORTS.find((s) => s.id === sport) ?? SPORTS[0]
  const pace = stats.distance > 20 ? elapsed / (stats.distance / 1000) : NaN
  const route = segments.flat().map((p) => [p.lat, p.lng] as [number, number])

  const start = () => {
    const t = Date.now()
    if (phase === 'ready') setStartedAt(t)
    setSegments((s) => (s.length && !s[s.length - 1].length ? s : [...s, []]))
    setResumedAt(t)
    setNow(t)
    setPhase('running')
    keepAwake(true)
  }
  const pause = () => {
    setElapsedBase(elapsed)
    setResumedAt(null)
    setPhase('paused')
    keepAwake(false)
  }
  const discard = () => {
    if (!confirm('Discard this activity?')) return
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    keepAwake(false)
    onClose()
  }
  const finish = async () => {
    if (phase === 'running') pause()
    if (stats.distance < 50 && !confirm('Less than 50 m recorded. Save anyway?')) return
    setBusy(true)
    const lw = await latestWeight()
    const kg = Number(lw?.weight_kg ?? profile?.start_weight_kg ?? 80)
    const kcal = Math.round(sp.met * kg * (elapsed / 3600))
    const { data, error } = await supabase
      .from('workout_logs')
      .insert({
        title: sp.label,
        kind: sport,
        done_at: new Date(startedAt || Date.now()).toISOString(),
        duration_min: Math.max(1, Math.round(elapsed / 60)),
        duration_s: Math.round(elapsed),
        distance_m: Math.round(stats.distance),
        elevation_gain_m: stats.gain,
        kcal,
        route: thin(route),
        splits: stats.splits,
      })
      .select('id')
      .single()
    setBusy(false)
    if (error) return toast(error.message)
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    keepAwake(false)
    toast(`${sp.label} saved ✓`)
    onSaved(data.id as number)
  }

  return (
    <div className="tracker">
      <div className="tracker-map">
        <RouteMap route={route} live here={here} height="100%" />
        <div className="tracker-top">
          <span className={'pill gps ' + gps}>{gps === 'good' ? 'GPS ready' : gps === 'weak' ? 'Weak GPS' : gps === 'denied' ? 'Location blocked' : 'Finding GPS…'}</span>
          {phase === 'ready' && <button className="btn ghost sm" onClick={onClose}>Close</button>}
        </div>
      </div>
      <div className="tracker-panel">
        {phase === 'ready' && (
          <div className="seg" style={{ marginBottom: 14 }}>
            {SPORTS.map((s) => (
              <button key={s.id} className={sport === s.id ? 'on' : ''} onClick={() => setSport(s.id)}>{s.label}</button>
            ))}
          </div>
        )}
        <div className="tracker-stats">
          <div><div className="v num">{fmtDuration(elapsed)}</div><div className="l">Time</div></div>
          <div><div className="v num">{fmtKm(stats.distance)}</div><div className="l">km</div></div>
          <div>
            <div className="v num">{sp.pace ? fmtPace(pace) : stats.distance > 20 ? ((stats.distance / 1000) / (elapsed / 3600)).toFixed(1) : '–'}</div>
            <div className="l">{sp.pace ? 'avg /km' : 'km/h'}</div>
          </div>
        </div>
        {gps === 'denied' && <p className="small" style={{ color: 'var(--warn)' }}>Allow location for Lighter: iPhone Settings → Privacy → Location Services → Safari Websites → While Using.</p>}
        {phase === 'ready' && <p className="small muted">Keep Lighter open while you move. iPhone pauses GPS for web apps when the screen locks, so the screen stays on during the activity.</p>}
        <div className="row" style={{ marginTop: 12 }}>
          {phase === 'ready' && <button className="btn block big-btn" disabled={gps === 'denied'} onClick={start}>Start</button>}
          {phase === 'running' && <button className="btn ghost block big-btn" onClick={pause}>Pause</button>}
          {phase === 'paused' && (
            <>
              <button className="btn grow big-btn" onClick={start}>Resume</button>
              <button className="btn outline grow big-btn" disabled={busy} onClick={finish}>{busy ? 'Saving…' : 'Finish'}</button>
            </>
          )}
        </div>
        {phase === 'paused' && <button className="link" style={{ color: 'var(--warn)', marginTop: 8 }} onClick={discard}>Discard</button>}
      </div>
    </div>
  )
}

export const hasActiveActivity = () => !!load()
