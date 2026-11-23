import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const dark = () => {
  const t = document.documentElement.dataset.theme
  if (t) return t === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/** Map with a route line. `live` keeps the view following the last point. */
export default function RouteMap({ route, live = false, height = 260, here }: { route: [number, number][]; live?: boolean; height?: number | string; here?: [number, number] | null }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const line = useRef<L.Polyline | null>(null)
  const dot = useRef<L.CircleMarker | null>(null)
  const start = useRef<L.CircleMarker | null>(null)
  const fitted = useRef(false)

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true })
    // Free OpenStreetMap tiles (no API key). Dark mode is a CSS filter on the tiles.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: dark() ? 'tiles-dark' : '',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(m)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f7d5b'
    line.current = L.polyline([], { color: accent, weight: 5, opacity: 0.9, lineJoin: 'round' }).addTo(m)
    m.setView([51.1657, 10.4515], 5)
    map.current = m
    return () => {
      m.remove()
      map.current = null
      fitted.current = false
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || !line.current) return
    line.current.setLatLngs(route)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f7d5b'
    if (route.length && !start.current) start.current = L.circleMarker(route[0], { radius: 6, color: '#fff', weight: 2, fillColor: accent, fillOpacity: 1 }).addTo(m)
    const last = here ?? route[route.length - 1]
    if (last) {
      if (!dot.current) dot.current = L.circleMarker(last, { radius: 8, color: '#fff', weight: 3, fillColor: '#3a7bd5', fillOpacity: 1 }).addTo(m)
      else dot.current.setLatLng(last)
      if (!live) dot.current.setStyle({ fillColor: '#c7552b' })
    }
    if (live && last) m.setView(last, Math.max(m.getZoom(), 16), { animate: true })
    else if (!live && route.length > 1 && !fitted.current) {
      m.fitBounds(L.latLngBounds(route), { padding: [24, 24] })
      fitted.current = true
    }
  }, [route, live, here])

  return <div ref={el} className="route-map" style={{ height }} />
}
