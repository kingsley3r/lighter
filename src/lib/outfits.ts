import { useCallback, useEffect } from 'react'
import { useStore } from '../store'

export type Slot = 'hat' | 'gear' | 'bg'
export interface Outfit { hat?: string; gear?: string; bg?: string }
export interface Item { id: string; slot: Slot; name: string; icon: string; trophy: string }

/** Every item is unlocked by a trophy (ids from lib/pip.ts). */
export const ITEMS: Item[] = [
  { id: 'cap', slot: 'hat', name: 'Gym cap', icon: '🧢', trophy: 'first_bite' },
  { id: 'beanie', slot: 'hat', name: 'Cosy beanie', icon: '🧶', trophy: 'streak_3' },
  { id: 'chef', slot: 'hat', name: 'Chef hat', icon: '👨‍🍳', trophy: 'meals_50' },
  { id: 'party', slot: 'hat', name: 'Party hat', icon: '🥳', trophy: 'kg_1' },
  { id: 'viking', slot: 'hat', name: 'Viking helmet', icon: '⚔️', trophy: 'protein_10' },
  { id: 'crown', slot: 'hat', name: 'Crown', icon: '👑', trophy: 'kg_5' },
  { id: 'shades', slot: 'gear', name: 'Sunglasses', icon: '🕶️', trophy: 'workout_1' },
  { id: 'bands', slot: 'gear', name: 'Sweatbands', icon: '🎽', trophy: 'gps_1' },
  { id: 'bowtie', slot: 'gear', name: 'Bow tie', icon: '🎀', trophy: 'clean_5' },
  { id: 'scarf', slot: 'gear', name: 'Scarf', icon: '🧣', trophy: 'streak_7' },
  { id: 'medal', slot: 'gear', name: 'Gold medal', icon: '🥇', trophy: 'target_5' },
  { id: 'headphones', slot: 'gear', name: 'Headphones', icon: '🎧', trophy: 'km_50' },
  { id: 'cape', slot: 'gear', name: 'Hero cape', icon: '🦸', trophy: 'workout_25' },
  { id: 'park', slot: 'bg', name: 'Park', icon: '🌳', trophy: 'first_bite' },
  { id: 'gym', slot: 'bg', name: 'Gym', icon: '🏋️', trophy: 'workout_1' },
  { id: 'kitchen', slot: 'bg', name: 'Kitchen', icon: '🥗', trophy: 'clean_50' },
  { id: 'beach', slot: 'bg', name: 'Beach', icon: '🏖️', trophy: 'kg_1' },
  { id: 'night', slot: 'bg', name: 'Starry night', icon: '🌙', trophy: 'streak_7' },
  { id: 'mountain', slot: 'bg', name: 'Mountains', icon: '🏔️', trophy: 'km_50' },
  { id: 'stadium', slot: 'bg', name: 'Stadium', icon: '🏟️', trophy: 'pip_5' },
]

export function readLocalOutfit(): Outfit {
  try { return JSON.parse(localStorage.getItem('pip-outfit') || '{}') } catch { return {} }
}

export function useOutfit(): [Outfit, (o: Outfit) => Promise<void>] {
  const { profile, saveProfile } = useStore()
  const outfit: Outfit = profile?.pip_outfit ?? readLocalOutfit()
  const json = profile?.pip_outfit ? JSON.stringify(profile.pip_outfit) : null
  useEffect(() => { if (json) try { localStorage.setItem('pip-outfit', json) } catch { /* ignore */ } }, [json])
  const set = useCallback(async (o: Outfit) => {
    try { localStorage.setItem('pip-outfit', JSON.stringify(o)) } catch { /* ignore */ }
    await saveProfile({ pip_outfit: o })
  }, [saveProfile])
  return [outfit, set]
}
