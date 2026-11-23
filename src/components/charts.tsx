export interface Pt { x: string; label: string; y: number | null }

const W = 340
const H = 150
const PAD = { l: 30, r: 8, t: 10, b: 20 }

function ticks(min: number, max: number) {
  const span = max - min || 1
  return [min, min + span / 2, max]
}

function labelEvery(n: number) {
  return n <= 7 ? 1 : n <= 14 ? 2 : n <= 31 ? 7 : 14
}

export function LineChart({ data, color, target, unit = '', trend }: { data: Pt[]; color: string; target?: number | null; unit?: string; trend?: (number | null)[] }) {
  const vals = [...data.map((d) => d.y), ...(trend ?? [])].filter((v): v is number => v != null)
  if (!vals.length) return <div className="empty">No data yet</div>
  let min = Math.min(...vals, target ?? Infinity)
  let max = Math.max(...vals, target ?? -Infinity)
  const padV = Math.max(0.5, (max - min) * 0.1)
  min = Math.floor(min - padV)
  max = Math.ceil(max + padV)
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v: number) => PAD.t + ih - ((v - min) / (max - min || 1)) * ih
  const pts = data.map((d, i) => (d.y == null ? null : [x(i), y(d.y)] as const)).filter(Boolean) as [number, number][]
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const every = labelEvery(data.length)
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart">
        {ticks(min, max).map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.l - 5} y={y(t) + 3} textAnchor="end">{Math.round(t)}</text>
          </g>
        ))}
        {target != null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth="1.5" />
            <text x={W - PAD.r} y={y(target) - 4} textAnchor="end" style={{ fill: 'var(--accent)' }}>goal {target}{unit}</text>
          </g>
        )}
        {trend ? (
          <>
            <path d={trend.map((v, i) => (v == null ? '' : `${trend.slice(0, i).some((x) => x != null) ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="1.5" />)}
          </>
        ) : (
          <>
            <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.length <= 31 && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />)}
          </>
        )}
        {data.map((d, i) => (i % every === 0 || i === data.length - 1 ? <text key={d.x} x={x(i)} y={H - 4} textAnchor="middle">{d.label}</text> : null))}
      </svg>
    </div>
  )
}

export function BarChart({ data, color, target, unit = '' }: { data: Pt[]; color: string; target?: number | null; unit?: string }) {
  const vals = data.map((d) => d.y ?? 0)
  const max = Math.max(...vals, target ?? 0, 1) * 1.1
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const bw = iw / data.length
  const y = (v: number) => PAD.t + ih - (v / max) * ih
  const every = labelEvery(data.length)
  if (!vals.some((v) => v > 0)) return <div className="empty">No data yet</div>
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.l - 5} y={y(t) + 3} textAnchor="end">{t >= 1000 ? (t / 1000).toFixed(1) + 'k' : Math.round(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d.y ?? 0
          const h = (v / max) * ih
          const gap = Math.min(4, bw * 0.25)
          return v > 0 ? (
            <rect key={d.x} x={PAD.l + i * bw + gap / 2} y={y(v)} width={Math.max(1, bw - gap)} height={h} rx={Math.min(4, (bw - gap) / 2)} fill={color}>
              <title>{d.label}: {Math.round(v)}{unit}</title>
            </rect>
          ) : null
        })}
        {target != null && target > 0 && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="var(--text)" strokeOpacity="0.5" strokeDasharray="4 4" strokeWidth="1.5" />
        )}
        {data.map((d, i) => (i % every === 0 || i === data.length - 1 ? <text key={d.x} x={PAD.l + i * bw + bw / 2} y={H - 4} textAnchor="middle">{d.label}</text> : null))}
      </svg>
    </div>
  )
}
