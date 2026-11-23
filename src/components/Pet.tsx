import { GearBack, GearFront, Hat } from './PipWear'
import { ITEMS, useOutfit, type Outfit } from '../lib/outfits'
import Wardrobe, { PipBackground } from './Wardrobe'
import { useEffect, useId, useMemo, useState, type PointerEvent as RPointerEvent } from 'react'
import type { MealLog } from '../lib/types'
import { levelFor, newlyUnlocked, quality, usePipStats, type Trophy } from '../lib/pip'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Sheet, useToast } from './ui'

// "Pip": an original round sprout creature that lives in the Food tab.
// It is fed with every logged meal, its mood follows today's food, and it
// grows bigger and more muscular as you log meals and train.

export type Mood = 'sleepy' | 'hungry' | 'angry' | 'grumpy' | 'content' | 'happy' | 'stuffed' | 'queasy'

interface Targets { kcal: number; protein: number; carbs: number; fat: number }

const EMOJI: [RegExp, string][] = [
  [/egg|omelet/i, '🍳'], [/bacon/i, '🥓'], [/pizza/i, '🍕'], [/burger/i, '🍔'], [/fries|chips|pommes/i, '🍟'], [/hot ?dog/i, '🌭'],
  [/salad|lettuce|spinach/i, '🥗'], [/chicken|turkey/i, '🍗'], [/steak|beef|meat/i, '🥩'], [/fish|salmon|tuna|shrimp|cod/i, '🐟'],
  [/rice|risotto/i, '🍚'], [/pasta|spaghetti|noodle/i, '🍝'], [/bread|toast|sandwich|bagel/i, '🥪'], [/soup|stew/i, '🍲'],
  [/apple/i, '🍎'], [/banana/i, '🍌'], [/berr/i, '🫐'], [/orange|citrus/i, '🍊'], [/avocado/i, '🥑'], [/potato/i, '🥔'],
  [/yog|skyr|quark/i, '🥣'], [/oat|porridge|muesli|cereal|granola/i, '🥣'], [/cheese/i, '🧀'], [/nut|almond/i, '🥜'],
  [/cake|cookie|chocolate|dessert|ice cream|donut|candy/i, '🍰'], [/coffee|latte|cappuccino/i, '☕'], [/beer|wine|cocktail/i, '🍺'],
  [/cola|soda|juice|smoothie|shake/i, '🥤'], [/taco|burrito|wrap|kebab|d[öo]ner/i, '🌯'], [/sushi/i, '🍣'], [/curry/i, '🍛'], [/veg|broccoli|carrot/i, '🥦'],
]
export const foodEmoji = (name: string) => EMOJI.find(([r]) => r.test(name))?.[1] ?? '🍽️'

export function moodFor(meals: MealLog[], t: Targets, now = new Date()): Mood {
  const kcal = meals.reduce((a, m) => a + m.kcal, 0)
  const protein = meals.reduce((a, m) => a + Number(m.protein_g), 0)
  const fat = meals.reduce((a, m) => a + Number(m.fat_g), 0)
  const h = now.getHours() + now.getMinutes() / 60
  if (meals.length === 0) return h < 9 ? 'sleepy' : h >= 13 ? 'angry' : 'hungry'
  const last = [...meals].sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))[0]
  const since = (now.getTime() - new Date(last.eaten_at).getTime()) / 36e5
  if (since > 6 && h >= 10 && h <= 22 && kcal < t.kcal * 0.85) return 'angry'
  const junkToday = meals.filter((m) => quality(m) === 'junk').length
  if (quality(last) === 'junk' || junkToday >= 2) return 'grumpy'
  if (kcal > t.kcal * 1.12) return 'stuffed'
  if (fat > t.fat * 1.3) return 'queasy'
  if (kcal >= t.kcal * 0.85 && protein >= t.protein * 0.8) return 'happy'
  if (quality(last) === 'healthy') return 'happy'
  const expected = Math.min(1, Math.max(0, (h - 7) / 13))
  if (kcal < t.kcal * expected * 0.45 && h > 12) return 'hungry'
  return 'content'
}

const MOOD_TEXT: Record<Mood, string> = {
  sleepy: 'Still waking up… breakfast?',
  hungry: 'My tummy is rumbling. Feed me a meal!',
  angry: 'Hey! I haven’t eaten in ages. FEED ME! 😠',
  grumpy: 'Fast food again? I want real food to get strong. 😤',
  content: 'Doing fine. Keep the good food coming.',
  happy: 'Feeling strong! That’s the good stuff. 💪',
  stuffed: 'Oof, that was a lot today. A walk would help!',
  queasy: 'A bit greasy today… something lighter next?',
}

export function reactionFor(m: Pick<MealLog, 'name' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>): { text: string; good: boolean; angry?: boolean } {
  const k = Math.max(1, m.kcal)
  const p = Number(m.protein_g), f = Number(m.fat_g)
  const q = quality(m)
  if (q === 'junk') return { text: `Fast food?! 😤 ${m.kcal} kcal of junk`, good: false, angry: true }
  if (q === 'healthy' && p * 4 / k >= 0.25) return { text: `Real food + ${Math.round(p)} g protein! 💪`, good: true }
  if (q === 'healthy') return { text: 'Mmm, real food! 🥦 I feel stronger', good: true }
  if (p * 4 / k >= 0.28 && p >= 15) return { text: `Yum, ${Math.round(p)} g protein! 💪`, good: true }
  if (f * 9 / k > 0.5 && f >= 18) return { text: `Rich one… ${Math.round(f)} g fat`, good: false }
  if (k >= 900) return { text: `Huge meal! ${m.kcal} kcal`, good: false }
  return { text: `Tasty! ${m.kcal} kcal`, good: true }
}

const BODY: Record<Mood, [string, string]> = {
  sleepy: ['#b5dcc0', '#7fb894'],
  hungry: ['#c9dcb4', '#9cb985'],
  angry: ['#f2b3a1', '#d9776a'],
  grumpy: ['#d9c79b', '#b39a5f'],
  content: ['#a9dcb5', '#6fb689'],
  happy: ['#9fe0ad', '#4fb578'],
  stuffed: ['#b8d9a8', '#82b56f'],
  queasy: ['#cfd99a', '#a8b665'],
}

/** Pip's look by level: bigger, then arms, biceps, abs, pecs, V-taper, headband, champion belt. */
export function PetFigure({ mood, level, eating, flex = false, size = 170, pet = null, outfit }: { mood: Mood; level: number; eating: boolean; flex?: boolean; size?: number; pet?: { v: number; key: number } | null; outfit?: Outfit }) {
  const [c1, c2] = BODY[mood]
  const L = Math.max(1, Math.min(8, level))
  const scale = 0.74 + (L - 1) * 0.055 // 0.74 → 1.125
  const wide = mood === 'stuffed'
  const leaves = Math.min(4, 1 + Math.floor((L - 1) / 2))
  const arm = 8 + (L - 1) * 1.8 // arm thickness
  const bicep = L >= 3 ? 5 + (L - 3) * 2.2 : 0
  const flexing = L >= 3 && (flex || mood === 'happy')
  const taper = L >= 6 ? (L - 5) * 6 : 0 // shoulder width boost
  const bodyPath = wide
    ? 'M100 72 C156 72 172 118 168 142 C164 170 136 180 100 180 C64 180 36 170 32 142 C28 118 44 72 100 72Z'
    : `M100 72 C${148 + taper} 72 ${162 + taper} ${106 - taper / 2} 160 140 C158 168 134 180 100 180 C66 180 42 168 40 140 C${38 - taper} ${106 - taper / 2} ${52 - taper} 72 100 72Z`
  const shoulderL = 46 - taper * 0.6
  const shoulderR = 154 + taper * 0.6
  const ink = '#243b2c'
  const gid = 'pb' + useId().replace(/:/g, '')
  return (
    <svg className={`pet mood-${mood}${eating ? ' eating' : ''}${flexing ? ' flexing' : ''}${pet ? ' petted' : ''}`} width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </radialGradient>
      </defs>
      <ellipse className="pet-shadow" cx="100" cy="186" rx={(wide ? 64 : 52 + taper) * scale} ry="7" />
      <g transform={`translate(100 184) scale(${scale}) translate(-100 -184)`}>
        <g key={pet?.key ?? 0} className={pet ? `pet-pat p${pet.v}` : undefined}>
        <g className="pet-bob">
          {/* sprout */}
          <g className="pet-sprout">
            <path d="M100 74 Q98 52 104 36" stroke="#3f8a5a" strokeWidth="4" fill="none" strokeLinecap="round" />
            {leaves >= 1 && <path d="M103 44 Q122 26 138 36 Q122 52 103 44Z" fill="#5fb873" />}
            {leaves >= 2 && <path d="M101 52 Q80 36 66 46 Q82 60 101 52Z" fill="#6cc27f" />}
            {leaves >= 3 && <path d="M103 60 Q124 54 132 64 Q116 72 103 60Z" fill="#58ad6c" />}
            {leaves >= 4 && <path d="M100 64 Q82 62 74 72 Q90 78 100 64Z" fill="#62b977" />}
            {L >= 6 && (
              <g transform="translate(104 34)">
                {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-8" rx="5" ry="8" fill="#f6a5c0" transform={`rotate(${a})`} />)}
                <circle r="5" fill="#ffd45c" />
              </g>
            )}
          </g>
          <GearBack id={outfit?.gear} />
          {/* feet */}
          <ellipse cx="76" cy="174" rx={15 + (L >= 5 ? 3 : 0)} ry="8" fill={c2} />
          <ellipse cx="124" cy="174" rx={15 + (L >= 5 ? 3 : 0)} ry="8" fill={c2} />
          {/* body */}
          <path d={bodyPath} fill={`url(#${gid})`} />
          {/* belly / abs / pecs */}
          {L < 4 ? (
            <ellipse cx="100" cy="150" rx={wide ? 40 : 32} ry="22" fill="#fff" opacity=".28" />
          ) : (
            <g className="pet-abs" opacity={Math.min(0.9, 0.55 + (L - 4) * 0.1)} stroke={c2} strokeWidth="2.6" fill="#fff" fillOpacity=".25">
              {[0, 1, 2].map((r) => (
                <g key={r}>
                  <rect x="86" y={140 + r * 11} width="13" height="9" rx="4" />
                  <rect x="101" y={140 + r * 11} width="13" height="9" rx="4" />
                </g>
              ))}
            </g>
          )}
          {L >= 5 && (
            <g stroke={c2} strokeWidth="2.5" fill="none" opacity=".7" strokeLinecap="round">
              <path d={`M${78 - taper / 3} 136 Q90 130 98 135`} />
              <path d={`M${122 + taper / 3} 136 Q110 130 102 135`} />
            </g>
          )}
          {/* headband */}
          {L >= 4 && !outfit?.hat && outfit?.gear !== 'headphones' && (
            <g>
              <path d="M58 92 Q100 74 142 92" stroke="#e0565b" strokeWidth="7" fill="none" strokeLinecap="round" />
              <path d="M142 92 l12 -2 M142 94 l11 6" stroke="#e0565b" strokeWidth="4" strokeLinecap="round" />
            </g>
          )}
          {/* arms */}
          {flexing ? (
            <g className="pet-flex">
              <path className="pet-arm l" d={`M${shoulderL} 128 Q${shoulderL - 24} 124 ${shoulderL - 20} 98`} stroke={c2} strokeWidth={arm} fill="none" strokeLinecap="round" />
              <path className="pet-arm r" d={`M${shoulderR} 128 Q${shoulderR + 24} 124 ${shoulderR + 20} 98`} stroke={c2} strokeWidth={arm} fill="none" strokeLinecap="round" />
              {bicep > 0 && <>
                <circle className="pet-bicep l" cx={shoulderL - 16} cy={118} r={bicep} fill={c2} />
                <circle className="pet-bicep r" cx={shoulderR + 16} cy={118} r={bicep} fill={c2} />
                <circle cx={shoulderL - 18} cy={115} r={bicep * 0.35} fill="#fff" opacity=".35" />
                <circle cx={shoulderR + 14} cy={115} r={bicep * 0.35} fill="#fff" opacity=".35" />
              </>}
              <circle cx={shoulderL - 20} cy={96} r={arm * 0.62} fill={c2} />
              <circle cx={shoulderR + 20} cy={96} r={arm * 0.62} fill={c2} />
            </g>
          ) : (
            <g>
              <path className="pet-arm l" d={`M${shoulderL} 130 Q${shoulderL - 16} 136 ${shoulderL - 14} 152`} stroke={c2} strokeWidth={arm} fill="none" strokeLinecap="round" />
              <path className="pet-arm r" d={`M${shoulderR} 130 Q${shoulderR + 16} 136 ${shoulderR + 14} 152`} stroke={c2} strokeWidth={arm} fill="none" strokeLinecap="round" />
              {bicep > 0 && <>
                <ellipse cx={shoulderL - 10} cy={137} rx={bicep * 0.8} ry={bicep * 0.65} fill={c2} />
                <ellipse cx={shoulderR + 10} cy={137} rx={bicep * 0.8} ry={bicep * 0.65} fill={c2} />
              </>}
            </g>
          )}
          {/* champion belt */}
          {L >= 8 && (
            <g>
              <rect x="44" y="158" width="112" height="10" rx="4" fill="#c9971c" />
              <ellipse cx="100" cy="163" rx="14" ry="9" fill="#ffd45c" stroke="#c9971c" strokeWidth="2" />
              <text x="100" y="167" textAnchor="middle" fontSize="10" fontWeight="800" fill="#8a6400">1</text>
            </g>
          )}
          {/* cheeks */}
          <ellipse cx="66" cy="126" rx="10" ry="6" fill="#f39aa8" opacity={mood === 'happy' ? 0.75 : mood === 'angry' ? 0.2 : 0.45} />
          <ellipse cx="134" cy="126" rx="10" ry="6" fill="#f39aa8" opacity={mood === 'happy' ? 0.75 : mood === 'angry' ? 0.2 : 0.45} />
          <Eyes mood={mood} ink={ink} />
          <Mouth mood={mood} eating={eating} ink={ink} />
 <GearFront id={outfit?.gear} shoulderL={shoulderL} shoulderR={shoulderR} flexing={flexing} />
          <Hat id={outfit?.hat} />
          {mood === 'sleepy' && <text x="148" y="78" className="pet-z" fontSize="18" fill="var(--muted)">z</text>}
          {mood === 'queasy' && <ellipse cx="150" cy="104" rx="4" ry="6" fill="#8ccbea" className="pet-sweat" />}
          {mood === 'grumpy' && <text x="138" y="92" fontSize="20" className="pet-vein">💢</text>}
          {mood === 'angry' && (
            <g className="pet-steam" fill="#c9c9c9">
              <circle cx="58" cy="70" r="7" /><circle cx="50" cy="58" r="5" />
              <circle cx="142" cy="70" r="7" /><circle cx="150" cy="58" r="5" />
            </g>
          )}
          {pet && (
            <g className="pet-blush" fill="#f37d92">
              <ellipse cx="66" cy="126" rx="12" ry="7" /><ellipse cx="134" cy="126" rx="12" ry="7" />
            </g>
          )}
        </g>
        </g>
      </g>
    </svg>
  )
}

function Eyes({ mood, ink }: { mood: Mood; ink: string }) {
  if (mood === 'sleepy') {
    return (
      <g stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M70 110 Q78 116 86 110" /><path d="M114 110 Q122 116 130 110" />
      </g>
    )
  }
  if (mood === 'happy') {
    return (
      <g stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none">
        <path d="M68 112 Q78 100 88 112" /><path d="M112 112 Q122 100 132 112" />
      </g>
    )
  }
  const mad = mood === 'angry' || mood === 'grumpy'
  return (
    <g className="pet-eyes">
      <ellipse cx="78" cy="110" rx="8" ry={mood === 'hungry' ? 11 : mad ? 8 : 10} fill={ink} />
      <ellipse cx="122" cy="110" rx="8" ry={mood === 'hungry' ? 11 : mad ? 8 : 10} fill={ink} />
      <circle cx="81" cy="106" r="3" fill="#fff" /><circle cx="125" cy="106" r="3" fill="#fff" />
      {mad && <path d={mood === 'angry' ? 'M64 92 L90 102 M136 92 L110 102' : 'M66 96 L90 101 M134 96 L110 101'} stroke={ink} strokeWidth={mood === 'angry' ? 5 : 4} strokeLinecap="round" />}
      {mood === 'queasy' && <path d="M68 94 L88 98 M132 94 L112 98" stroke={ink} strokeWidth="3" strokeLinecap="round" />}
    </g>
  )
}

function Mouth({ mood, eating, ink }: { mood: Mood; eating: boolean; ink: string }) {
  if (eating) return <ellipse className="pet-chomp" cx="100" cy="134" rx="13" ry="11" fill="#7a2f3a" />
  switch (mood) {
    case 'hungry': return <ellipse cx="100" cy="136" rx="8" ry="9" fill="#7a2f3a" />
    case 'angry': return <path className="pet-shout" d="M84 140 Q100 124 116 140 Z" fill="#7a2f3a" />
    case 'grumpy': return <path d="M86 140 Q100 130 114 140" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
    case 'happy': return <path d="M84 128 Q100 150 116 128 Z" fill="#7a2f3a" />
    case 'stuffed': return <path d="M88 134 Q100 128 112 134" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
    case 'queasy': return <path d="M86 136 Q93 130 100 136 Q107 142 114 136" stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    case 'sleepy': return <ellipse cx="100" cy="134" rx="5" ry="4" fill="#7a2f3a" />
    default: return <path d="M88 130 Q100 142 112 130" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
  }
}

export interface FeedEvent { id: number; name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }

export default function PetCard({ meals, targets, feed, onFeed }: { meals: MealLog[]; targets: Targets; feed: FeedEvent | null; onFeed: () => void }) {
  const { version } = useStore()
  const toast = useToast()
  const stats = usePipStats(version, targets.kcal, targets.protein)
  const [name, setName] = useState(() => { try { return localStorage.getItem('pet-name') || 'Pip' } catch { return 'Pip' } })
  const [eating, setEating] = useState<FeedEvent | null>(null)
  const [bubble, setBubble] = useState<{ text: string; good: boolean; angry?: boolean } | null>(null)
  const [trophies, setTrophies] = useState(false)
  const [wardrobe, setWardrobe] = useState(false)
  const [outfit] = useOutfit()
  const [pet, setPet] = useState<{ v: number; key: number; text: string } | null>(null)
  const [taps, setTaps] = useState<{ at: number; n: number }>({ at: 0, n: 0 })
  const [hearts, setHearts] = useState<{ id: number; x: number; e: string }[]>([])
  const [petCount, setPetCount] = useState(() => { try { return Number(localStorage.getItem('pet-pets') || 0) } catch { return 0 } })
  const mood = useMemo(() => moodFor(meals, targets), [meals, targets])
  const xp = stats?.xp ?? 0
  const lv = levelFor(xp)

  // share Pip's look with friends (name, level, outfit only)
  const { profile } = useStore()
  useEffect(() => {
    if (!stats) return
    const row = { name: profile?.display_name ?? null, pip_name: name, pip_level: lv.lvl, outfit }
    const key = JSON.stringify(row)
    try { if (localStorage.getItem('buddy-sync') === key) return } catch { /* ignore */ }
    supabase.from('buddy_status').upsert({ ...row, updated_at: new Date().toISOString() }).then(({ error }) => { if (!error) try { localStorage.setItem('buddy-sync', key) } catch { /* ignore */ } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, name, lv.lvl, JSON.stringify(outfit), profile?.display_name])

  // level-up + trophy celebrations
  useEffect(() => {
    if (!stats) return
    let prevLvl = 0
    try { prevLvl = Number(localStorage.getItem('pip-level') || 0) } catch { /* ignore */ }
    try { localStorage.setItem('pip-level', String(lv.lvl)) } catch { /* ignore */ }
    if (prevLvl && lv.lvl > prevLvl) toast(`🎉 ${name} grew to level ${lv.lvl}: ${lv.title}!`)
    const fresh = newlyUnlocked(stats.trophies)
    if (fresh.length) setTimeout(() => toast(`🏆 Trophy unlocked: ${fresh.map((t) => t.title).join(', ')}`), prevLvl && lv.lvl > prevLvl ? 2600 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats])

  useEffect(() => {
    if (!feed) return
    setEating(feed)
    setBubble(null)
    const t1 = setTimeout(() => { setEating(null); setBubble(reactionFor(feed)) }, 1500)
    const t2 = setTimeout(() => setBubble(null), 5500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [feed])

  const sumOf = (k: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => meals.reduce((a, m) => a + Number(m[k]), 0)
  const bars: [string, number, number, string, string][] = [
    ['Calories', sumOf('kcal'), targets.kcal, 'var(--accent)', 'kcal'],
    ['Protein', sumOf('protein_g'), targets.protein, 'var(--protein)', 'g'],
    ['Carbs', sumOf('carbs_g'), targets.carbs, 'var(--carbs)', 'g'],
    ['Fat', sumOf('fat_g'), targets.fat, 'var(--fat)', 'g'],
  ]
  const unlocked = stats?.trophies.filter((t) => t.value >= t.goal).length ?? 0

  const rename = () => {
    const n = prompt('Name your buddy', name)?.trim().slice(0, 16)
    if (!n) return
    setName(n)
    try { localStorage.setItem('pet-name', n) } catch { /* ignore */ }
  }

  // petting: tap Pip → jump / wiggle / spin, smile, blush, hearts
  useEffect(() => {
    if (!pet) return
    const t = setTimeout(() => setPet(null), 1700)
    return () => clearTimeout(t)
  }, [pet])
  const petMe = (e: RPointerEvent<HTMLButtonElement>) => {
    if (eating) return
    const now = Date.now()
    const n = now - taps.at < 2500 ? taps.n + 1 : 1
    setTaps({ at: now, n })
    const v = (n - 1) % 3
    const lines = mood === 'angry' || mood === 'grumpy'
      ? ['Hmph… okay, that helps 😌', 'Still hungry… but thanks', 'Fine, one more pat 😤💚']
      : mood === 'sleepy' ? ['Mmm… 5 more minutes 😴', 'Hehe, sleepy pats', 'Zzz… 💤']
      : ['Hehe! 😊', 'Wheee! 🤸', 'More pats please! 💚', 'That tickles! 😆', 'Best buddy ever 🥰', 'Again! Again!']
    const text = n >= 6 ? 'Okay okay, I love you too! 💕' : lines[(n - 1) % lines.length]
    setPet({ v, key: now, text })
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.max(10, Math.min(r.width - 20, e.clientX - r.left))
    const emo = ['💚', '💕', '✨', '😊']
    setHearts((h) => [...h.slice(-6), { id: now, x, e: emo[n % emo.length] }])
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== now)), 1300)
    try { navigator.vibrate?.(15) } catch { /* ignore */ }
    const c = petCount + 1
    setPetCount(c)
    try { localStorage.setItem('pet-pets', String(c)) } catch { /* ignore */ }
  }

  const shown: Mood = pet ? 'happy' : eating ? 'content' : bubble?.angry ? 'grumpy' : bubble?.good ? 'happy' : mood

  return (
    <section className="card pet-card">
      <button className={`pet-stage${outfit.bg ? ' has-bg' : ''}`} onPointerDown={petMe} aria-label={`Pet ${name}`}>
        <PipBackground id={outfit.bg} />
        <PetFigure mood={shown} level={lv.lvl} eating={!!eating} flex={!!bubble?.good && !pet} pet={pet} outfit={outfit} />
        {eating && <span key={eating.id} className="pet-food">{foodEmoji(eating.name)}</span>}
        {pet && !eating ? <div key={pet.key} className="pet-bubble good">{pet.text}</div>
          : bubble && <div className={`pet-bubble${bubble.good ? ' good' : ''}${bubble.angry ? ' bad' : ''}`}>{bubble.text}</div>}
        {hearts.map((h) => <span key={h.id} className="pet-pat-heart" style={{ left: h.x }} aria-hidden="true">{h.e}</span>)}
        {petCount < 3 && !pet && !bubble && !eating && <span className="pet-hint">Tap to pet</span>}
        {bubble?.good && !pet && <div className="pet-hearts" aria-hidden="true"><span>💚</span><span>💪</span><span>💚</span></div>}
      </button>
      <div className="pet-info">
        <div className="row between">
          <button className="pet-name" onClick={rename} aria-label="Rename your buddy">{name} <span className="small muted">✎</span></button>
          <span className="pill">Lv {lv.lvl}</span>
        </div>
        <div className="small muted" style={{ marginTop: 2 }}>{lv.title}{lv.next ? ` · ${lv.toNext} XP to grow` : ' · max level'}</div>
        <div className="xp"><i style={{ width: `${Math.round(lv.progress * 100)}%` }} /></div>
        <p className="small" style={{ margin: '8px 0 10px' }}>{MOOD_TEXT[mood]}</p>
        <div className="bowl">
          {bars.map(([label, v, t, color, unit]) => {
            const pct = t > 0 ? v / t : 0
            return (
              <div key={label} className="bowl-row">
                <span>{label}</span>
                <div className={`bowl-bar${pct > 1.12 ? ' over' : ''}`}><i style={{ width: `${Math.min(100, pct * 100)}%`, background: color }} /></div>
                <span className="num">{Math.round(v)}<span className="muted">/{t}{unit === 'g' ? 'g' : ''}</span></span>
              </div>
            )
          })}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn grow" onClick={onFeed}>📷 Feed {name}</button>
          <button className="btn ghost" onClick={() => setWardrobe(true)} aria-label="Wardrobe">👕</button>
          <button className="btn ghost" onClick={() => setTrophies(true)} aria-label="Trophies">🏆 {unlocked}</button>
        </div>
      </div>
      {wardrobe && <Wardrobe trophies={stats?.trophies ?? []} level={lv.lvl} name={name} onClose={() => setWardrobe(false)} />}
      {trophies && <TrophySheet trophies={stats?.trophies ?? []} name={name} xp={xp} onClose={() => setTrophies(false)} />}
    </section>
  )
}

export function TrophySheet({ trophies, name, xp, onClose }: { trophies: Trophy[]; name: string; xp: number; onClose: () => void }) {
  const lv = levelFor(xp)
  const done = trophies.filter((t) => t.value >= t.goal)
  return (
    <Sheet title="Trophies" onClose={onClose}>
      <div className="trophy-head">
        <PetFigure mood="happy" level={lv.lvl} eating={false} flex size={96} />
        <div>
          <b style={{ fontSize: 18 }}>{done.length} / {trophies.length} unlocked</b>
          <div className="small muted">{name} is a level {lv.lvl} {lv.title} · {xp} XP</div>
          <div className="small muted" style={{ marginTop: 4 }}>XP: meal +10 · healthy meal +6 · workout +25 · tracked run +20 · protein day +10 · fast food −4</div>
        </div>
      </div>
      <div className="trophy-grid">
        {trophies.map((t) => {
          const ok = t.value >= t.goal
          return (
            <div key={t.id} className={`trophy${ok ? ' ok' : ''}`}>
              <span className="trophy-icon">{t.icon}</span>
              <b>{t.title}</b>
              <span className="small muted">{t.desc}</span>
              {ITEMS.some((i) => i.trophy === t.id) && <span className="trophy-gift" title="Unlocks for Pip">🎁 {ITEMS.filter((i) => i.trophy === t.id).map((i) => i.icon).join(' ')}</span>}
              {ok ? <span className="trophy-done">Unlocked</span> : (
                <div className="trophy-prog"><i style={{ width: `${Math.round((t.value / t.goal) * 100)}%` }} /><span>{t.value}/{t.goal}</span></div>
              )}
            </div>
          )
        })}
      </div>
      <h3 style={{ marginTop: 16 }}>How {name} grows</h3>
      <div className="grow-row">
        {[1, 3, 5, 7, 8].map((l) => (
          <div key={l} className={l <= lv.lvl ? 'on' : ''}>
            <PetFigure mood={l <= lv.lvl ? 'happy' : 'content'} level={l} eating={false} flex={l >= 3} size={60} />
            <span>Lv {l}</span>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
