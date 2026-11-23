import { useEffect, useState } from 'react'

// Animated launch screen: activity ring fills, logo pops in, pulse line runs, wordmark rises.
export default function Splash() {
  const [phase, setPhase] = useState<'on' | 'out' | 'gone'>(() => {
    try { return sessionStorage.getItem('splash') ? 'gone' : 'on' } catch { return 'on' }
  })
  useEffect(() => {
    if (phase !== 'on') return
    try { sessionStorage.setItem('splash', '1') } catch { /* ignore */ }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t1 = setTimeout(() => setPhase('out'), reduce ? 600 : 2100)
    const t2 = setTimeout(() => setPhase('gone'), reduce ? 900 : 2550)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [phase])
  if (phase === 'gone') return null
  return (
    <div className={`splash${phase === 'out' ? ' out' : ''}`} onClick={() => setPhase('out')} aria-hidden="true">
      <div className="splash-mark">
        <svg className="splash-ring" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="88" className="track" />
          <circle cx="100" cy="100" r="88" className="fill" />
        </svg>
        <svg className="splash-logo" viewBox="0 0 512 512">
          <rect width="512" height="512" rx="112" fill="#2f7d5b" />
          <g className="splash-leaf">
            <path d="M150 300c0-70 50-140 106-170 56 30 106 100 106 170 0 58-47 102-106 102s-106-44-106-102z" fill="#f6f7f4" />
            <path d="M256 190v200" stroke="#2f7d5b" strokeWidth="22" strokeLinecap="round" />
            <path d="M256 290l-48-40M256 250l44-34" stroke="#2f7d5b" strokeWidth="18" strokeLinecap="round" />
          </g>
        </svg>
        <span className="splash-spark s1" /><span className="splash-spark s2" /><span className="splash-spark s3" />
      </div>
      <svg className="splash-pulse" viewBox="0 0 240 40" preserveAspectRatio="none">
        <path d="M0 22 H70 L82 22 L92 6 L104 36 L116 12 L124 22 H240" />
      </svg>
      <div className="splash-word">Lighter</div>
      <div className="splash-tag">Move more · Eat well · Feel lighter</div>
    </div>
  )
}
