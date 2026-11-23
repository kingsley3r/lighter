import { useState } from 'react'
import { ITEMS, useOutfit, type Outfit, type Slot } from '../lib/outfits'
import type { Trophy } from '../lib/pip'
import { PetFigure } from './Pet'
import { Seg, Sheet, useToast } from './ui'

const SLOTS: { id: Slot; label: string }[] = [{ id: 'hat', label: 'Hats' }, { id: 'gear', label: 'Gear' }, { id: 'bg', label: 'Places' }]

export function PipBackground({ id }: { id?: string }) {
  if (!id) return null
  return <div className={`pip-bg bg-${id}`} aria-hidden="true"><i /><b /></div>
}

export default function Wardrobe({ trophies, level, name, onClose }: { trophies: Trophy[]; level: number; name: string; onClose: () => void }) {
  const toast = useToast()
  const [saved, save] = useOutfit()
  const [draft, setDraft] = useState<Outfit>(saved)
  const [slot, setSlot] = useState<Slot>('hat')
  const done = new Set(trophies.filter((t) => t.value >= t.goal).map((t) => t.id))
  const tById = new Map(trophies.map((t) => [t.id, t]))
  const owned = ITEMS.filter((i) => done.has(i.trophy)).length
  const changed = JSON.stringify(draft) !== JSON.stringify(saved)

  async function apply() {
    try { await save(draft); toast(`${name} loves the new look! ✨`); onClose() } catch (e) { toast((e as Error).message) }
  }

  return (
    <Sheet title={`${name}’s wardrobe`} onClose={onClose}>
      <div className="wr-stage">
        <PipBackground id={draft.bg} />
        <PetFigure mood="happy" level={level} eating={false} flex size={150} outfit={draft} />
      </div>
      <p className="small muted" style={{ textAlign: 'center', margin: '6px 0 12px' }}>{owned} of {ITEMS.length} unlocked · earn trophies to unlock more</p>
      <Seg options={SLOTS} value={slot} onChange={setSlot} />
      <div className="wr-grid">
        <button className={`wr-item${!draft[slot] ? ' on' : ''}`} onClick={() => setDraft({ ...draft, [slot]: undefined })}>
          <span className="wr-icon">🚫</span><span className="wr-name">None</span>
        </button>
        {ITEMS.filter((i) => i.slot === slot).map((i) => {
          const open = done.has(i.trophy)
          const t = tById.get(i.trophy)
          return (
            <button key={i.id} className={`wr-item${draft[slot] === i.id ? ' on' : ''}${open ? '' : ' locked'}`}
              onClick={() => open ? setDraft({ ...draft, [slot]: i.id }) : toast(`🔒 Unlock with the trophy “${t?.title ?? i.trophy}”: ${t?.desc ?? ''}`)}>
              <span className="wr-icon">{open ? i.icon : '🔒'}</span>
              <span className="wr-name">{i.name}</span>
              {!open && t && <span className="wr-need">{t.icon} {t.title}</span>}
            </button>
          )
        })}
      </div>
      <button className="btn block" style={{ marginTop: 14 }} disabled={!changed} onClick={apply}>{changed ? 'Wear this' : 'Wearing this'}</button>
    </Sheet>
  )
}
