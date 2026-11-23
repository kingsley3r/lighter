import type { Muscle } from '../data/guide'
import { MUSCLE_LABEL } from '../data/guide'

type Shape = { m: Muscle; dx: number; y: number; rx: number; ry: number; rot?: number }

// Shapes are mirrored left/right around each figure's centre line (dx = distance from centre)
const FRONT: Shape[] = [
  { m: 'front_delts', dx: 20, y: 40, rx: 6, ry: 6 },
  { m: 'side_delts', dx: 25, y: 43, rx: 3, ry: 5 },
  { m: 'chest', dx: 8, y: 49, rx: 8.5, ry: 6.5 },
  { m: 'biceps', dx: 26, y: 59, rx: 4, ry: 10, rot: 8 },
  { m: 'forearms', dx: 31, y: 92, rx: 3.5, ry: 12, rot: 10 },
  { m: 'abs', dx: 3.5, y: 72, rx: 3.5, ry: 14 },
  { m: 'obliques', dx: 12, y: 72, rx: 3.5, ry: 11 },
  { m: 'quads', dx: 8.5, y: 122, rx: 6.5, ry: 19 },
  { m: 'adductors', dx: 2.5, y: 113, rx: 2.5, ry: 9 },
  { m: 'calves', dx: 9, y: 168, rx: 3.5, ry: 12 },
]
const BACK: Shape[] = [
  { m: 'traps', dx: 6, y: 38, rx: 7, ry: 7, rot: -25 },
  { m: 'rear_delts', dx: 20, y: 41, rx: 6, ry: 6 },
  { m: 'side_delts', dx: 25, y: 43, rx: 3, ry: 5 },
  { m: 'triceps', dx: 26, y: 60, rx: 4, ry: 10, rot: 8 },
  { m: 'forearms', dx: 31, y: 92, rx: 3.5, ry: 12, rot: 10 },
  { m: 'upper_back', dx: 7, y: 52, rx: 6, ry: 6 },
  { m: 'lats', dx: 13, y: 66, rx: 5.5, ry: 12, rot: -12 },
  { m: 'lower_back', dx: 3.5, y: 84, rx: 3.5, ry: 8 },
  { m: 'glutes', dx: 8, y: 103, rx: 8, ry: 8 },
  { m: 'hamstrings', dx: 8.5, y: 130, rx: 6, ry: 17 },
  { m: 'calves', dx: 9, y: 166, rx: 5, ry: 12 },
]

function Silhouette({ cx }: { cx: number }) {
  const limb = (x1: number, y1: number, x2: number, y2: number, w: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={w} className="mm-base-limb" />
  return (
    <g>
      <circle cx={cx} cy={16} r={10} className="mm-base" />
      <rect x={cx - 4} y={24} width={8} height={8} className="mm-base" />
      <path d={`M${cx - 24} ${36} Q${cx} ${28} ${cx + 24} ${36} L${cx + 17} ${92} L${cx + 18} ${104} L${cx - 18} ${104} L${cx - 17} ${92} Z`} className="mm-base" />
      {[-1, 1].map((s) => (
        <g key={s}>
          {limb(cx + s * 24, 40, cx + s * 28, 76, 10)}
          {limb(cx + s * 28, 78, cx + s * 33, 112, 8)}
          {limb(cx + s * 9, 104, cx + s * 9, 150, 15)}
          {limb(cx + s * 9, 152, cx + s * 9, 188, 10)}
        </g>
      ))}
    </g>
  )
}

function Layer({ cx, shapes, primary, secondary }: { cx: number; shapes: Shape[]; primary: Muscle[]; secondary: Muscle[] }) {
  return (
    <g>
      {shapes.flatMap((sh) =>
        [-1, 1].map((s) => {
          const cls = primary.includes(sh.m) ? 'mm on' : secondary.includes(sh.m) ? 'mm half' : 'mm'
          const x = cx + s * sh.dx
          return <ellipse key={sh.m + s} cx={x} cy={sh.y} rx={sh.rx} ry={sh.ry} transform={sh.rot ? `rotate(${s * sh.rot} ${x} ${sh.y})` : undefined} className={cls}><title>{MUSCLE_LABEL[sh.m]}</title></ellipse>
        }),
      )}
    </g>
  )
}

export default function MuscleMap({ primary, secondary, size = 260 }: { primary: Muscle[]; secondary: Muscle[]; size?: number }) {
  return (
    <div>
      <svg viewBox="0 0 220 200" width={size} height={(size * 200) / 220} className="muscle-map" role="img" aria-label={`Works ${primary.map((m) => MUSCLE_LABEL[m]).join(', ')}`}>
        <Silhouette cx={55} />
        <Silhouette cx={165} />
        <Layer cx={55} shapes={FRONT} primary={primary} secondary={secondary} />
        <Layer cx={165} shapes={BACK} primary={primary} secondary={secondary} />
        <text x={55} y={199} textAnchor="middle" className="mm-label">Front</text>
        <text x={165} y={199} textAnchor="middle" className="mm-label">Back</text>
      </svg>
      <div className="mm-legend">
        <div><span className="dot on" /> Main: {primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</div>
        {secondary.length > 0 && <div><span className="dot half" /> Also: {secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</div>}
      </div>
    </div>
  )
}
