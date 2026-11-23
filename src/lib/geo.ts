export interface GeoPoint { lat: number; lng: number; t: number; alt: number | null; acc: number }

const R = 6371000
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface TrackStats { distance: number; gain: number; splits: number[] }

/** Distance (m), elevation gain (m) and per-km split times (s). Segments are given as arrays of points (pauses break segments). */
export function trackStats(segments: GeoPoint[][]): TrackStats {
  let distance = 0
  let gain = 0
  const splits: number[] = []
  let nextKm = 1000
  let movingTime = 0
  let lastSplitAt = 0
  for (const seg of segments) {
    let lastAlt: number | null = null
    for (let i = 1; i < seg.length; i++) {
      const d = haversine(seg[i - 1], seg[i])
      const dt = (seg[i].t - seg[i - 1].t) / 1000
      distance += d
      movingTime += dt
      while (distance >= nextKm) {
        splits.push(Math.round(movingTime - lastSplitAt))
        lastSplitAt = movingTime
        nextKm += 1000
      }
      const alt = seg[i].alt
      if (alt != null) {
        if (lastAlt != null && alt - lastAlt > 2) gain += alt - lastAlt
        if (lastAlt == null || Math.abs(alt - lastAlt) > 2) lastAlt = alt
      }
    }
  }
  return { distance, gain: Math.round(gain), splits }
}

/** Douglas–Peucker-ish simplification by minimum spacing to keep stored routes small. */
export function thin(points: [number, number][], minMeters = 8): [number, number][] {
  if (points.length < 3) return points
  const out: [number, number][] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]
    if (haversine({ lat: a[0], lng: a[1] }, { lat: points[i][0], lng: points[i][1] }) >= minMeters) out.push([Math.round(points[i][0] * 1e5) / 1e5, Math.round(points[i][1] * 1e5) / 1e5])
  }
  out.push(points[points.length - 1])
  return out
}

export const fmtDuration = (s: number) => {
  s = Math.max(0, Math.round(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
export const fmtPace = (secPerKm: number) => (isFinite(secPerKm) && secPerKm > 0 && secPerKm < 3600 ? `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')}` : '–:––')
export const fmtKm = (m: number) => (m / 1000).toFixed(2)

export const SPORTS: { id: string; label: string; met: number; pace: boolean }[] = [
  { id: 'run', label: 'Run', met: 9.8, pace: true },
  { id: 'walk', label: 'Walk', met: 3.8, pace: true },
  { id: 'hike', label: 'Hike', met: 6, pace: true },
  { id: 'ride', label: 'Ride', met: 7.5, pace: false },
]
