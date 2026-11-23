import { useEffect, useRef, useState } from 'react'
import type { Anim } from '../data/guide'

/*
 * Original animated stick figure, side view, facing right.
 * Angles: 0 = pointing down, 90 = forward (right), 180 = up, -90 = backward (left).
 * Limbs are either angles [upper, lower] or an IK target (absolute or relative to the shoulder / hip).
 */
type Pt = [number, number]
type Limb = { a: Pt } | { to: Pt; bend?: 1 | -1 } | { rel: Pt; bend?: 1 | -1 }
interface Pose {
  hip?: Pt // absolute hip position
  foot?: Pt // or: anchor near ankle here (computed from leg 1 angles)
  t: number // torso angle, hip -> neck
  arm1: Limb
  arm2?: Limb
  leg1: Limb
  leg2?: Limb
}
type Prop = 'db' | 'kb' | 'bar' | 'pullbar' | 'bench' | 'box' | 'table' | 'bike' | 'rower' | 'rope' | 'band'

const FLOOR = 150
const L = { torso: 40, ua: 22, fa: 20, th: 30, sh: 30 }
const rad = (d: number) => (d * Math.PI) / 180
const vec = (a: number, len: number): Pt => [Math.sin(rad(a)) * len, Math.cos(rad(a)) * len]
const add = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1]]
const sub = (p: Pt, q: Pt): Pt => [p[0] - q[0], p[1] - q[1]]

function ik(root: Pt, target: Pt, a: number, b: number, bend: number): [Pt, Pt] {
  const d = sub(target, root)
  let dist = Math.hypot(d[0], d[1])
  const max = a + b - 0.01
  const t: Pt = dist > max ? add(root, [(d[0] / dist) * max, (d[1] / dist) * max]) : target
  dist = Math.min(dist, max)
  const base = Math.atan2(d[1], d[0])
  const cos = Math.max(-1, Math.min(1, (a * a + dist * dist - b * b) / (2 * a * dist || 1)))
  const ang = base + bend * Math.acos(cos)
  const mid: Pt = [root[0] + Math.cos(ang) * a, root[1] + Math.sin(ang) * a]
  return [mid, t]
}

function limb(root: Pt, l: Limb, a: number, b: number, defBend: number): [Pt, Pt] {
  if ('a' in l) {
    const m = add(root, vec(l.a[0], a))
    return [m, add(m, vec(l.a[1], b))]
  }
  const target = 'to' in l ? l.to : add(root, l.rel)
  return ik(root, target, a, b, l.bend ?? defBend)
}

function solve(p: Pose) {
  let hip: Pt
  if (p.hip) hip = p.hip
  else {
    const l = p.leg1 as { a: Pt }
    const f = p.foot ?? [100, FLOOR - 3]
    hip = sub(sub(f, vec(l.a[1], L.sh)), vec(l.a[0], L.th))
  }
  const neck = add(hip, vec(p.t, L.torso))
  const shoulder = add(hip, vec(p.t, L.torso - 3))
  const head = add(neck, vec(p.t, 10))
  const arm1 = limb(shoulder, p.arm1, L.ua, L.fa, -1)
  const arm2 = limb(shoulder, p.arm2 ?? p.arm1, L.ua, L.fa, -1)
  const leg1 = limb(hip, p.leg1, L.th, L.sh, 1)
  const leg2 = limb(hip, p.leg2 ?? p.leg1, L.th, L.sh, 1)
  return { hip, neck, shoulder, head, arm1, arm2, leg1, leg2 }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerpPt = (a: Pt, b: Pt, k: number): Pt => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]
function lerpLimb(a: Limb, b: Limb, k: number): Limb {
  if ('a' in a && 'a' in b) return { a: lerpPt(a.a, b.a, k) }
  if ('to' in a && 'to' in b) return { to: lerpPt(a.to, b.to, k), bend: a.bend }
  if ('rel' in a && 'rel' in b) return { rel: lerpPt(a.rel, b.rel, k), bend: a.bend }
  return k < 0.5 ? a : b
}
function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return {
    hip: a.hip && b.hip ? lerpPt(a.hip, b.hip, k) : undefined,
    foot: a.foot && b.foot ? lerpPt(a.foot, b.foot, k) : a.foot ?? b.foot,
    t: lerp(a.t, b.t, k),
    arm1: lerpLimb(a.arm1, b.arm1, k),
    arm2: lerpLimb(a.arm2 ?? a.arm1, b.arm2 ?? b.arm1, k),
    leg1: lerpLimb(a.leg1, b.leg1, k),
    leg2: lerpLimb(a.leg2 ?? a.leg1, b.leg2 ?? b.leg1, k),
  }
}

const A = (u: number, l: number): Limb => ({ a: [u, l] })
const STAND: Pose = { foot: [100, FLOOR - 3], t: 180, arm1: A(0, 0), leg1: A(0, 0) }
const st = (o: Partial<Pose>): Pose => ({ ...STAND, ...o })

interface Spec { frames: Pose[]; ms: number; props?: Prop[] }

function spec(anim: Anim, gear: string[]): Spec {
  const has = (g: string) => gear.includes(g)
  const handProp: Prop[] = has('barbell') ? ['bar'] : has('kettlebell') ? ['kb'] : has('dumbbells') ? ['db'] : has('bands') ? ['band'] : []
  switch (anim) {
    case 'squat': {
      const arms: Limb = has('barbell') ? A(-40, 175) : handProp.length ? { rel: [12, 6], bend: -1 } : A(90, 90)
      const armsLow: Limb = has('barbell') ? A(-20, 175) : handProp.length ? { rel: [12, 6], bend: -1 } : A(95, 95)
      return { ms: 2600, props: has('barbell') ? ['bar'] : handProp, frames: [st({ arm1: arms, foot: [95, 147] }), st({ t: 145, leg1: A(82, -32), arm1: armsLow, foot: [95, 147] })] }
    }
    case 'hinge':
      return { ms: 2800, props: handProp, frames: [st({ foot: [105, 147] }), st({ foot: [105, 147], t: 100, leg1: A(14, -4) })] }
    case 'swing':
      return { ms: 1500, props: ['kb'], frames: [st({ foot: [105, 147], t: 118, leg1: A(28, -10), arm1: A(-25, -30) }), st({ foot: [105, 147], arm1: A(88, 88) })] }
    case 'bridge':
      return { ms: 2400, frames: [
        { foot: [140, 147], t: -88, arm1: A(-92, -92), leg1: A(138, 18) },
        { foot: [140, 147], t: -58, arm1: A(-60, -88), leg1: A(96, 2) },
      ] }
    case 'lunge':
      return { ms: 2800, props: handProp, frames: [
        st({ foot: [112, 147], leg2: A(0, 0) }),
        st({ foot: [112, 147], leg1: A(86, 0), leg2: A(-22, -78) }),
      ] }
    case 'stepup':
      return { ms: 2600, props: ['box'], frames: [
        { foot: [128, 117], t: 168, arm1: A(10, 20), arm2: A(-15, -5), leg1: A(72, -12), leg2: { to: [96, 147] } },
        { foot: [128, 117], t: 180, arm1: A(-10, 5), arm2: A(10, 20), leg1: A(0, 0), leg2: A(20, -45) },
      ] }
    case 'pushup':
      return { ms: 2400, frames: [
        { foot: [38, 147], t: 108, arm1: { to: [134, 147], bend: 1 }, leg1: A(-72, -72) },
        { foot: [38, 147], t: 99, arm1: { to: [134, 147], bend: 1 }, leg1: A(-81, -81) },
      ] }
    case 'pikepush':
      return { ms: 2400, frames: [
        { foot: [50, 147], t: 38, arm1: { to: [118, 147], bend: 1 }, leg1: A(-28, -28) },
        { foot: [50, 147], t: 28, arm1: { to: [118, 147], bend: 1 }, leg1: A(-32, -32) },
      ] }
    case 'floorpress': {
      const bench = has('bench')
      const y = bench ? 116 : 139
      return { ms: 2400, props: [...(bench ? ['bench' as Prop] : []), ...handProp], frames: [
        { hip: [118, y], t: -90, arm1: { rel: [0, -41] }, leg1: { to: [150, 147] } },
        { hip: [118, y], t: -90, arm1: { rel: [4, -16], bend: 1 }, leg1: { to: [150, 147] } },
      ] }
    }
    case 'press':
      return { ms: 2200, props: handProp, frames: [st({ foot: [90, 147], arm1: { rel: [12, 2], bend: -1 } }), st({ foot: [90, 147], arm1: { rel: [41, 2] } })] }
    case 'ohp':
      return { ms: 2400, props: handProp, frames: [st({ arm1: { rel: [6, -2], bend: -1 } }), st({ arm1: { rel: [3, -41], bend: -1 } })] }
    case 'row':
      return { ms: 2200, props: handProp, frames: [
        st({ foot: [100, 147], t: 105, leg1: A(18, -8), arm1: { rel: [0, 41] } }),
        st({ foot: [100, 147], t: 105, leg1: A(18, -8), arm1: { rel: [-14, 16], bend: 1 } }),
      ] }
    case 'invrow':
      return { ms: 2400, props: ['table'], frames: [
        { foot: [40, 147], t: 104, arm1: { to: [150, 74] }, leg1: A(-76, -76) },
        { foot: [40, 147], t: 122, arm1: { to: [150, 74], bend: 1 }, leg1: A(-58, -58) },
      ] }
    case 'pullup':
    case 'kneeraise': {
      const legs: Limb = A(12, -35)
      if (anim === 'kneeraise')
        return { ms: 2400, props: ['pullbar'], frames: [
          { hip: [100, 102], t: 180, arm1: { to: [101, 18] }, leg1: legs },
          { hip: [100, 102], t: 186, arm1: { to: [101, 18] }, leg1: A(105, 10) },
        ] }
      return { ms: 2600, props: ['pullbar'], frames: [
        { hip: [100, 102], t: 180, arm1: { to: [101, 18] }, leg1: legs },
        { hip: [100, 78], t: 180, arm1: { to: [101, 18], bend: -1 }, leg1: legs },
      ] }
    }
    case 'pulldown':
      return { ms: 2400, props: ['band'], frames: [st({ arm1: { rel: [6, -41] } }), st({ arm1: { rel: [2, 4], bend: -1 } })] }
    case 'superman':
      return { ms: 2600, frames: [
        { hip: [95, 141], t: 92, arm1: A(92, 92), leg1: A(-92, -92) },
        { hip: [95, 142], t: 104, arm1: A(108, 108), leg1: A(-102, -104) },
      ] }
    case 'plank':
    case 'sideplank':
      return { ms: 3000, frames: [
        { foot: [38, 147], t: 103, arm1: A(0, 90), arm2: anim === 'sideplank' ? A(180, 180) : undefined, leg1: A(-77, -77) },
        { foot: [38, 147], t: 104, arm1: A(-2, 90), arm2: anim === 'sideplank' ? A(180, 180) : undefined, leg1: A(-78, -78) },
      ] }
    case 'deadbug':
      return { ms: 2800, frames: [
        { hip: [115, 141], t: -90, arm1: A(180, 180), arm2: A(180, 180), leg1: A(180, 90), leg2: A(180, 90) },
        { hip: [115, 141], t: -90, arm1: A(-100, -100), arm2: A(180, 180), leg1: A(95, 95), leg2: A(180, 90) },
      ] }
    case 'climber': {
      const base = { hip: [92, 124] as Pt, t: 108, arm1: { to: [131, 147], bend: 1 } as Limb }
      return { ms: 900, frames: [
        { ...base, leg1: { to: [40, 147] }, leg2: { to: [90, 142] } },
        { ...base, leg1: { to: [90, 142] }, leg2: { to: [40, 147] } },
      ] }
    }
    case 'walk':
    case 'jacks': {
      const knee = anim === 'jacks' ? 80 : 25
      return { ms: anim === 'jacks' ? 700 : 1100, frames: [
        { hip: [100, anim === 'jacks' ? 90 : 89], t: 180, arm1: A(-25, 10), arm2: A(25, 70), leg1: A(knee, anim === 'jacks' ? -10 : 0), leg2: A(-18, -25) },
        { hip: [100, anim === 'jacks' ? 90 : 89], t: 180, arm1: A(25, 70), arm2: A(-25, 10), leg1: A(-18, -25), leg2: A(knee, anim === 'jacks' ? -10 : 0) },
      ] }
    }
    case 'bike': {
      const c: Pt = [116, 128]
      const ped = (a: number): Limb => ({ to: [c[0] + Math.cos(rad(a)) * 12, c[1] + Math.sin(rad(a)) * 12], bend: 1 })
      const base = { hip: [92, 88] as Pt, t: 140, arm1: { to: [140, 74] } as Limb }
      return { ms: 1100, props: ['bike'], frames: [0, 90, 180, 270].map((a) => ({ ...base, leg1: ped(a), leg2: ped(a + 180) })) }
    }
    case 'rower':
      return { ms: 2600, props: ['rower'], frames: [
        { hip: [88, 137], t: 152, arm1: { to: [140, 124] }, leg1: { to: [142, 140], bend: -1 } },
        { hip: [62, 137], t: 200, arm1: { rel: [18, 14], bend: 1 }, leg1: { to: [142, 140], bend: -1 } },
      ] }
    case 'rope':
      return { ms: 600, props: ['rope'], frames: [
        st({ foot: [100, 147], arm1: A(8, 60) }),
        st({ foot: [100, 140], arm1: A(8, 60) }),
      ] }
  }
}

export default function ExerciseFigure({ anim, gear = [], size = 220 }: { anim: Anim; gear?: string[]; size?: number }) {
  const s = spec(anim, gear)
  const [now, setNow] = useState(0)
  const start = useRef(performance.now())
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let id = 0
    const tick = () => {
      setNow(performance.now() - start.current)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])

  const n = s.frames.length
  let pose: Pose
  if (n === 2) {
    const k = (1 - Math.cos((2 * Math.PI * now) / s.ms)) / 2
    pose = lerpPose(s.frames[0], s.frames[1], k)
  } else {
    const per = s.ms / n
    const i = Math.floor(now / per) % n
    const k = (now % per) / per
    pose = lerpPose(s.frames[i], s.frames[(i + 1) % n], k)
  }
  const j = solve(pose)
  const line = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const props = s.props ?? []
  const hand1 = j.arm1[1]
  const hand2 = j.arm2[1]
  const foot = (knee: Pt, ankle: Pt): Pt => {
    const d = sub(ankle, knee)
    const len = Math.hypot(d[0], d[1]) || 1
    // perpendicular, pointing forward
    return add(ankle, [(-d[1] / len) * -8, (d[0] / len) * -8])
  }

  return (
    <svg viewBox="0 0 200 165" width={size} height={(size * 165) / 200} className="ex-fig" role="img" aria-label="Animated demonstration">
      <line x1="10" y1={FLOOR} x2="190" y2={FLOOR} className="fig-floor" />
      {props.includes('pullbar') && <line x1="55" y1="16" x2="150" y2="16" className="fig-prop thick" />}
      {props.includes('bench') && <rect x="70" y="122" width="80" height="8" rx="3" className="fig-prop-fill" />}
      {props.includes('bench') && <line x1="80" y1="130" x2="80" y2={FLOOR} className="fig-prop" />}
      {props.includes('bench') && <line x1="140" y1="130" x2="140" y2={FLOOR} className="fig-prop" />}
      {props.includes('box') && <rect x="112" y="120" width="44" height={FLOOR - 120} rx="3" className="fig-prop-fill" />}
      {props.includes('table') && <path d={`M120 74 L192 74 M184 74 L184 ${FLOOR}`} className="fig-prop thick" />}
      {props.includes('rower') && <path d={`M20 ${FLOOR - 6} L170 ${FLOOR - 6} M142 128 L148 ${FLOOR - 6}`} className="fig-prop" />}
      {props.includes('bike') && (
        <g className="fig-prop">
          <circle cx="116" cy="128" r="12" fill="none" />
          <path d={`M92 92 L116 128 L140 74 M84 90 L100 90 M116 128 L104 ${FLOOR} M116 128 L132 ${FLOOR} M134 74 L146 74`} />
        </g>
      )}
      {/* far limbs */}
      <path d={line([j.shoulder, ...j.arm2])} className="fig-limb far" />
      <path d={line([j.hip, ...j.leg2, foot(j.leg2[0], j.leg2[1])])} className="fig-limb far" />
      {/* body */}
      <path d={line([j.hip, j.neck])} className="fig-limb body" />
      <circle cx={j.head[0]} cy={j.head[1]} r="8" className="fig-head" />
      <path d={line([j.hip, ...j.leg1, foot(j.leg1[0], j.leg1[1])])} className="fig-limb" />
      <path d={line([j.shoulder, ...j.arm1])} className="fig-limb" />
      {props.includes('rope') && (
        <path d={`M${hand1[0]} ${hand1[1]} C${hand1[0] + 30} ${now % s.ms < s.ms / 2 ? FLOOR + 10 : -30} ${hand1[0] - 45} ${now % s.ms < s.ms / 2 ? FLOOR + 10 : -30} ${hand1[0] - 6} ${hand1[1]}`} className="fig-prop" fill="none" />
      )}
      {props.includes('db') && <rect x={hand1[0] - 7} y={hand1[1] - 3} width="14" height="6" rx="2" className="fig-gear" />}
      {props.includes('kb') && <circle cx={hand1[0]} cy={hand1[1] + 6} r="6" className="fig-gear" />}
      {props.includes('bar') && <circle cx={hand1[0]} cy={hand1[1]} r="9" className="fig-gear ring" />}
      {props.includes('band') && <path d={`M${hand1[0]} ${hand1[1]} L${anim === 'pulldown' ? '110 0' : anim === 'press' ? '20 50' : `${j.leg1[1][0]} ${j.leg1[1][1]}`}`} className="fig-band" />}
    </svg>
  )
}
