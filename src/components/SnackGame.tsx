import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { earnCoins } from '../lib/coins'
import { readLocalOutfit } from '../lib/outfits'
import { PetFigure } from './Pet'
import { Sheet, useToast } from './ui'

const GOOD = ['🥦', '🍎', '🥕', '🍓', '🥚', '🐟', '🫐', '🥑', '🍌', '🥗']
const BAD = ['🍩', '🍔', '🍟', '🍭', '🥤', '🍕', '🧁']
const LENGTH = 45 // seconds
const PIP = 64 // px
interface Drop { x: number; y: number; v: number; e: string; good: boolean; hit?: boolean }

/** "Snack Catch": move Pip to catch healthy food and dodge junk. First game each day earns coins. */
export default function SnackGame({ level, onClose }: { level: number; onClose: () => void }) {
  const { refreshProfile, profile } = useStore()
  const toast = useToast()
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const pip = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [hud, setHud] = useState({ score: 0, lives: 3, left: LENGTH })
  const [result, setResult] = useState<{ score: number; coins: number | null; best: boolean } | null>(null)
  const best = (() => { try { return Number(localStorage.getItem('game-best') || 0) } catch { return 0 } })()

  useEffect(() => { if (pip.current && wrap.current) pip.current.style.transform = `translateX(${(wrap.current.clientWidth - PIP) / 2}px)` }, [])

  useEffect(() => {
    if (phase !== 'play') return
    const c = canvas.current!, box = wrap.current!
    const W = box.clientWidth, H = box.clientHeight, dpr = devicePixelRatio || 1
    c.width = W * dpr; c.height = H * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    let px = W / 2, target = W / 2, score = 0, lives = 3, raf = 0, spawn = 0, last = performance.now()
    const start = last
    const drops: Drop[] = []
    const pops: { x: number; y: number; t: number; txt: string }[] = []

    const move = (clientX: number) => { const r = box.getBoundingClientRect(); target = Math.max(PIP / 2, Math.min(W - PIP / 2, clientX - r.left)) }
    const onPointer = (e: PointerEvent) => move(e.clientX)
    const onTouch = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') target -= 40; if (e.key === 'ArrowRight') target += 40; target = Math.max(PIP / 2, Math.min(W - PIP / 2, target)) }
    box.addEventListener('pointermove', onPointer); box.addEventListener('pointerdown', onPointer)
    box.addEventListener('touchmove', onTouch, { passive: false }); window.addEventListener('keydown', onKey)

    const end = () => {
      cancelAnimationFrame(raf)
      setPhase('over')
      const isBest = score > best
      if (isBest) try { localStorage.setItem('game-best', String(score)) } catch { /* ignore */ }
      const coins = Math.min(30, score)
      earnCoins('game', coins).then((bal) => { setResult({ score, coins: bal == null ? null : coins, best: isBest }); if (bal != null) refreshProfile() })
        .catch(() => setResult({ score, coins: null, best: isBest }))
    }

    const tick = (t: number) => {
      const dt = Math.min(50, t - last) / 1000; last = t
      const elapsed = (t - start) / 1000
      const speed = 1 + elapsed / 30 // gets faster
      px += (target - px) * Math.min(1, dt * 14)
      if (pip.current) pip.current.style.transform = `translateX(${px - PIP / 2}px)`
      spawn -= dt
      if (spawn <= 0) {
        const good = Math.random() < 0.68
        const list = good ? GOOD : BAD
        drops.push({ x: 20 + Math.random() * (W - 40), y: -20, v: (110 + Math.random() * 70) * speed, e: list[Math.floor(Math.random() * list.length)], good })
        spawn = Math.max(0.35, 0.85 - elapsed / 90)
      }
      ctx.clearRect(0, 0, W, H)
      ctx.font = '30px system-ui, "Apple Color Emoji", sans-serif'
      for (const d of drops) {
        d.y += d.v * dt
        if (!d.hit && d.y > H - PIP + 6 && d.y < H - 12 && Math.abs(d.x - px) < PIP / 2 + 6) {
          d.hit = true
          if (d.good) { score++; pops.push({ x: d.x, y: d.y, t, txt: '+1' }); try { navigator.vibrate?.(15) } catch { /* ignore */ } }
          else { lives--; pops.push({ x: d.x, y: d.y, t, txt: '💥' }); try { navigator.vibrate?.(120) } catch { /* ignore */ } }
        }
        if (!d.hit) ctx.fillText(d.e, d.x, d.y)
      }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].hit || drops[i].y > H + 30) drops.splice(i, 1)
      ctx.font = 'bold 20px system-ui, sans-serif'
      for (const p of pops) { const a = 1 - (t - p.t) / 600; if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = p.txt === '+1' ? '#2f9d6b' : '#c7552b'; ctx.fillText(p.txt, p.x, p.y - (1 - a) * 30) } }
      ctx.globalAlpha = 1
      const left = Math.max(0, Math.ceil(LENGTH - elapsed))
      setHud((h) => (h.score === score && h.lives === lives && h.left === left ? h : { score, lives, left }))
      if (lives <= 0 || elapsed >= LENGTH) return end()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      box.removeEventListener('pointermove', onPointer); box.removeEventListener('pointerdown', onPointer)
      box.removeEventListener('touchmove', onTouch); window.removeEventListener('keydown', onKey)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => { setResult(null); setHud({ score: 0, lives: 3, left: LENGTH }); setPhase('play') }

  return (
    <Sheet title="Snack Catch" onClose={() => { if (phase !== 'play') onClose(); else if (confirm('Quit this game?')) onClose() }}>
      <div className="row between small" style={{ marginBottom: 8 }}>
        <span>🪙 <b className="num">{profile?.coins ?? 0}</b> coins</span>
        {phase === 'play' ? <span className="num"><b>{hud.score}</b> pts · {'❤️'.repeat(hud.lives)}{'🤍'.repeat(3 - hud.lives)} · {hud.left}s</span> : <span className="muted">Best: {Math.max(best, result?.score ?? 0)}</span>}
      </div>
      <div ref={wrap} className="game-box">
        <canvas ref={canvas} className="game-canvas" />
        <div ref={pip} className="game-pip">
          <PetFigure mood={hud.lives < 2 ? 'content' : 'happy'} level={level} eating={false} size={PIP} outfit={readLocalOutfit()} />
        </div>
        {phase !== 'play' && (
          <div className="game-overlay">
            {phase === 'ready' ? (
              <>
                <div style={{ fontSize: 40 }}>🥦🍎🍩</div>
                <b>Catch the healthy food, dodge the junk!</b>
                <p className="small">Slide your finger to move Pip. 3 lives, 45 seconds. Your first game each day earns up to 30 🪙 for the wardrobe.</p>
                <button className="btn" onClick={play}>▶ Play</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40 }}>{(result?.score ?? hud.score) >= 20 ? '🏆' : '🎉'}</div>
                <b className="num" style={{ fontSize: 26 }}>{result?.score ?? hud.score} points</b>
                {result?.best && <div className="small">New personal best!</div>}
                <p className="small">{!result ? 'Counting coins…' : result.coins != null ? `+${result.coins} 🪙 earned` : 'Practice round: coins are earned once a day. Come back tomorrow!'}</p>
                <button className="btn" onClick={play}>Play again</button>
              </>
            )}
          </div>
        )}
      </div>
      <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => { if (phase === 'play') return; onClose(); toast('Spend coins in the wardrobe 👕') }}>Done</button>
    </Sheet>
  )
}
