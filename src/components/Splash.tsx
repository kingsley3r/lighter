import { useEffect, useState } from 'react'
import { PetFigure } from './Pet'
import { readLocalOutfit } from '../lib/outfits'

// Launch screen: Pip drops in, lands with a squash, flexes, and the wordmark pops up. ~1.5 s.
export default function Splash() {
  const [phase, setPhase] = useState<'on' | 'out' | 'gone'>(() => {
    try { return sessionStorage.getItem('splash') ? 'gone' : 'on' } catch { return 'on' }
  })
  useEffect(() => {
    if (phase !== 'on') return
    try { sessionStorage.setItem('splash', '1') } catch { /* ignore */ }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t1 = setTimeout(() => setPhase('out'), reduce ? 500 : 1450)
    const t2 = setTimeout(() => setPhase('gone'), reduce ? 750 : 1800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [phase])
  if (phase === 'gone') return null
  let lvl = 5
  try { lvl = Math.max(3, Number(localStorage.getItem('pip-level') || 5)) } catch { /* ignore */ }
  return (
    <div className={`splash${phase === 'out' ? ' out' : ''}`} onClick={() => setPhase('out')} aria-hidden="true">
      <div className="splash-pip">
        <PetFigure mood="happy" level={lvl} eating={false} flex size={150} outfit={readLocalOutfit()} />
        <span className="splash-star a">✦</span><span className="splash-star b">✦</span><span className="splash-star c">✦</span>
      </div>
      <div className="splash-word">Lighter</div>
    </div>
  )
}
