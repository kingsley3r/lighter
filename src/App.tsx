import { useEffect, useState } from 'react'
import { useStore } from './store'
import AuthPage from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Food from './pages/Food'
import Train from './pages/Train'
import Stats from './pages/Stats'
import Me from './pages/Me'
import { IconFood, IconMe, IconStats, IconToday, IconTrain } from './components/icons'

export type Tab = 'today' | 'food' | 'train' | 'stats' | 'me'

const TABS: { id: Tab; label: string; Icon: () => React.JSX.Element }[] = [
  { id: 'today', label: 'Today', Icon: IconToday },
  { id: 'food', label: 'Food', Icon: IconFood },
  { id: 'train', label: 'Train', Icon: IconTrain },
  { id: 'stats', label: 'Stats', Icon: IconStats },
  { id: 'me', label: 'Me', Icon: IconMe },
]

export default function App() {
  const { session, profile, loading } = useStore()
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (sessionStorage.getItem('tab') as Tab) || 'today'
    } catch {
      return 'today'
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem('tab', tab)
    } catch {
      /* ignore */
    }
    window.scrollTo(0, 0)
  }, [tab])

  if (loading) return <div className="auth"><p className="muted">Loading…</p></div>
  if (!session) return <AuthPage />
  if (!profile) return <div className="auth"><p className="muted">Loading your profile…</p></div>
  if (!profile.onboarded) return <Onboarding />

  return (
    <>
      <main className="app">
        {tab === 'today' && <Today go={setTab} />}
        {tab === 'food' && <Food />}
        {tab === 'train' && <Train />}
        {tab === 'stats' && <Stats />}
        {tab === 'me' && <Me />}
      </main>
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
