import { useState } from 'react'
import { ITEMS, useOutfit, type Item, type Outfit, type Slot } from '../lib/outfits'
import { buyItem, priceOf } from '../lib/coins'
import { useStore } from '../store'
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
  const { profile, refreshProfile } = useStore()
  const [buying, setBuying] = useState<Item | null>(null)
  const coins = profile?.coins ?? 0
  const bought = new Set(profile?.pip_items ?? [])
  const done = new Set(trophies.filter((t) => t.value >= t.goal).map((t) => t.id))
  const tById = new Map(trophies.map((t) => [t.id, t]))
  const has = (i: Item) => done.has(i.trophy) || bought.has(i.id)
  const owned = ITEMS.filter(has).length

  async function buy(i: Item) {
    try { await buyItem(i.id); await refreshProfile(); setDraft({ ...draft, [i.slot]: i.id }); setBuying(null); toast(`${i.name} is yours! 🛍️`) } catch (e) { toast((e as Error).message) }
  }
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
      <p className="small muted" style={{ textAlign: 'center', margin: '6px 0 12px' }}>{owned} of {ITEMS.length} unlocked · 🪙 <b className="num">{coins}</b> coins · earn trophies or buy with coins</p>
      <Seg options={SLOTS} value={slot} onChange={setSlot} />
      <div className="wr-grid">
        <button className={`wr-item${!draft[slot] ? ' on' : ''}`} onClick={() => setDraft({ ...draft, [slot]: undefined })}>
          <span className="wr-icon">🚫</span><span className="wr-name">None</span>
        </button>
        {ITEMS.filter((i) => i.slot === slot).map((i) => {
          const open = has(i)
          const t = tById.get(i.trophy)
          return (
            <button key={i.id} className={`wr-item${draft[slot] === i.id ? ' on' : ''}${open ? '' : ' locked'}`}
              onClick={() => open ? setDraft({ ...draft, [slot]: i.id }) : setBuying(i)}>
              <span className="wr-icon">{open ? i.icon : '🔒'}</span>
              <span className="wr-name">{i.name}</span>
              {!open && <span className="wr-need">🪙 {priceOf(i.id)}</span>}
            </button>
          )
        })}
      </div>
      {buying && (
        <div className="card wr-buy">
          <div className="row" style={{ gap: 10 }}><span style={{ fontSize: 28 }}>{buying.icon}</span><div className="grow"><b>{buying.name}</b><div className="small muted">Unlock free with the trophy “{tById.get(buying.trophy)?.title ?? buying.trophy}”{tById.get(buying.trophy)?.desc ? `: ${tById.get(buying.trophy)?.desc}` : ''}, or buy it now.</div></div></div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn grow" disabled={coins < priceOf(buying.id)} onClick={() => buy(buying)}>{coins < priceOf(buying.id) ? `Need ${priceOf(buying.id) - coins} more 🪙` : `Buy for 🪙 ${priceOf(buying.id)}`}</button>
            <button className="btn ghost" onClick={() => setBuying(null)}>Not now</button>
          </div>
        </div>
      )}
      <button className="btn block" style={{ marginTop: 14 }} disabled={!changed} onClick={apply}>{changed ? 'Wear this' : 'Wearing this'}</button>
    </Sheet>
  )
}
