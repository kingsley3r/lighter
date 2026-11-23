import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { latestWeight } from '../lib/data'
import { readLocalOutfit } from '../lib/outfits'
import { PetFigure } from './Pet'
import { useToast } from './ui'

const STEP = 5
const STAGE_NAME = ['Sprout', 'Budding Pip', 'Blooming Pip', 'Radiant Pip', 'Golden Pip']
export const stageName = (s: number) => STAGE_NAME[Math.min(STAGE_NAME.length - 1, s)]

/** Mounted once in the app. After a weigh-in, checks whether a new 5 kg milestone was reached and celebrates it. */
export default function MilestoneWatcher() {
  const { profile, version, saveProfile } = useStore()
  const [show, setShow] = useState<{ kg: number; from: number; to: number } | null>(null)
  const done = profile?.milestone_kg ?? 0

  // keep the local copy of Pip's stage in sync with the account
  useEffect(() => { try { localStorage.setItem('pip-stage', String(Math.floor(done / STEP))) } catch { /* ignore */ } }, [done])

  useEffect(() => {
    if (!profile?.start_weight_kg) return
    latestWeight().then((w) => {
      if (!w) return
      const lost = Number(profile.start_weight_kg) - Number(w.weight_kg)
      const reached = Math.floor(lost / STEP) * STEP
      // wait for the splash screen on app start
      if (reached >= STEP && reached > done) setTimeout(() => setShow({ kg: reached, from: Math.floor(done / STEP), to: reached / STEP }), Math.max(0, 2600 - performance.now()))
    })
  }, [version, profile?.start_weight_kg, done])

  if (!show) return null
  return <Celebration {...show} onClose={async () => { setShow(null); await saveProfile({ milestone_kg: show.kg }) }} />
}

function Celebration({ kg, from, to, onClose }: { kg: number; from: number; to: number; onClose: () => void }) {
  const { profile } = useStore()
  const toast = useToast()
  const canvas = useRef<HTMLCanvasElement>(null)
  const pip = useRef<HTMLDivElement>(null)
  const [evolved, setEvolved] = useState(false)

  useEffect(() => { const t = setTimeout(() => setEvolved(true), 1400); return () => clearTimeout(t) }, [])
  useEffect(() => confetti(canvas.current), [])
  useEffect(() => { try { navigator.vibrate?.([80, 60, 80, 60, 200]) } catch { /* ignore */ } }, [])

  const toGo = profile?.target_weight_kg != null && profile.start_weight_kg != null ? Math.round((Number(profile.start_weight_kg) - kg - Number(profile.target_weight_kg)) * 10) / 10 : null

  async function share() {
    const svg = pip.current?.querySelector('svg')
    const blob = await shareCard(kg, stageName(to), svg ?? null)
    if (!blob) return toast('Could not make the image')
    const file = new File([blob], `lighter-${kg}kg.png`, { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
    if (nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], text: `${kg} kg down with Lighter 💪` }) } catch { /* cancelled */ }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      toast('Image saved')
    }
  }

  return (
    <div className="milestone" role="dialog" aria-label={`${kg} kg milestone`}>
      <canvas ref={canvas} className="ms-confetti" />
      <div className="ms-card">
        <div className="ms-kicker">Milestone unlocked</div>
        <div className="ms-big num">−{kg} kg</div>
        <div ref={pip} className={`ms-pip${evolved ? ' evolved' : ''}`}>
          <PetFigure mood="happy" level={8} eating={false} flex size={170} outfit={readLocalOutfit()} stage={evolved ? to : from} />
        </div>
        <p className="ms-text">{evolved ? <>Pip evolved into <b>{stageName(to)}</b>! 🌸</> : 'Pip is changing…'}</p>
        <p className="small muted" style={{ margin: '0 0 16px' }}>{toGo != null && toGo > 0 ? `Only ${toGo} kg to your goal. Keep going!` : 'You did the work. Be proud of this one.'}</p>
        <button className="btn block" onClick={share}>📤 Share card</button>
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onClose}>Continue</button>
      </div>
    </div>
  )
}

function confetti(c: HTMLCanvasElement | null) {
  if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const ctx = c.getContext('2d')!
  const dpr = devicePixelRatio || 1
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr)
  const colors = ['#2f7d5b', '#f6c453', '#f493b8', '#3c7dd9', '#e07b2a', '#6cc27f']
  const bits = Array.from({ length: 160 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, c: colors[Math.floor(Math.random() * colors.length)] }))
  let raf = 0, t0 = performance.now()
  const tick = (t: number) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const b of bits) {
      b.vy += 0.32; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.a += b.va
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c; ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2); ctx.restore()
    }
    if (t - t0 < 4500) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight)
  }
  raf = requestAnimationFrame(tick)
  t0 = performance.now()
  return () => cancelAnimationFrame(raf)
}

/** 1080×1350 share image: big number, Pip, app name. No weights, only the amount lost. */
async function shareCard(kg: number, stage: string, svg: SVGSVGElement | null): Promise<Blob | null> {
  const W = 1080, H = 1350
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')
  if (!x) return null
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2f7d5b'); g.addColorStop(1, '#1d4e39')
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 18; i++) { x.beginPath(); x.arc((i * 263) % W, (i * 397) % H, 30 + (i % 5) * 18, 0, 7); x.fill() }
  x.textAlign = 'center'; x.fillStyle = '#f6c453'
  x.font = '600 44px system-ui, -apple-system, sans-serif'; x.fillText('MILESTONE UNLOCKED', W / 2, 190)
  x.fillStyle = '#fff'; x.font = '800 240px system-ui, -apple-system, sans-serif'; x.fillText(`−${kg} kg`, W / 2, 440)
  if (svg) {
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.querySelectorAll('.pet-shadow').forEach((e) => e.setAttribute('fill', 'rgba(0,0,0,.18)'))
    clone.setAttribute('width', '560'); clone.setAttribute('height', '560'); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
    await new Promise<void>((ok) => { const img = new Image(); img.onload = () => { x.drawImage(img, (W - 560) / 2, 500, 560, 560); ok() }; img.onerror = () => ok(); img.src = url })
    URL.revokeObjectURL(url)
  }
  x.fillStyle = '#fff'; x.font = '600 52px system-ui, -apple-system, sans-serif'; x.fillText(`Pip is now ${stage} 🌸`, W / 2, 1140)
  x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '500 40px system-ui, -apple-system, sans-serif'; x.fillText('Lighter', W / 2, 1260)
  return new Promise((ok) => c.toBlob(ok, 'image/png'))
}
