import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Profile } from './lib/types'

interface Store {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  saveProfile: (patch: Partial<Profile>) => Promise<void>
  version: number
  bump: () => void
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('Store missing')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (data) setProfile(data as Profile)
    else {
      const { data: created } = await supabase.from('profiles').insert({ id: uid }).select('*').single()
      setProfile((created as Profile) ?? null)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
      else setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id)
  }, [session, loadProfile])

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!session) return
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', session.user.id).select('*').single()
      if (error) throw error
      setProfile(data as Profile)
    },
    [session],
  )

  const bump = useCallback(() => setVersion((v) => v + 1), [])

  return (
    <Ctx.Provider value={{ session, profile, loading, refreshProfile, saveProfile, version, bump }}>{children}</Ctx.Provider>
  )
}

export function useTheme(): [string, (t: string) => void] {
  const [theme, setThemeState] = useState<string>(() => {
    try {
      return localStorage.getItem('theme') || 'system'
    } catch {
      return 'system'
    }
  })
  const setTheme = (t: string) => {
    setThemeState(t)
    try {
      if (t === 'system') localStorage.removeItem('theme')
      else localStorage.setItem('theme', t)
    } catch {
      /* ignore */
    }
    if (t === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = t
  }
  return [theme, setTheme]
}
