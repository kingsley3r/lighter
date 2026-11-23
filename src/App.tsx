import { useEffect, useState } from 'react'
import { useStore } from './store'
import AuthPage from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Food from './pages/Food'
import Train from './pages/Train'
import Stats from './pages/Stats'
import Me from './pages/Me'
import FriendsSheet from './components/Friends'
import MilestoneWatcher from './components/Milestones'
import { IconFood, IconMe, IconStats, IconToday, IconTrain } from './components/icons'

export type Tab = 'today' | 'food' | 'train' | 'stats' | 'me'

const TABS: { id: Tab; label: string; Icon: () => React.JSX.Element }[] = [
  { id: 'today', label: 'Today', Icon: IconToday },
  { id: 'food', label: 'Food', Icon: IconFood },
  { id: 'train', label: 'Train', Icon: IconTrain },
  { id: 'stats', label: 'Stats', Icon: IconStats },
  { id: 'me', label: 'Me', Icon: IconMe },
]

// ?friend=CODE invite links survive sign-up via localStorage
try {
  const c = new URLSearchParams(location.search).get('friend')
  if (c) { localStorage.setItem('friend-invite', c.toUpperCase().slice(0, 8)); history.replaceState(null, '', location.pathname) }
} catch { /* ignore */ }

export default function App() {
  const { session, profile, loading } = useStore()
  const [invite, setInvite] = useState<string | null>(() => { try { return localStorage.getItem('friend-invite') } catch { return null } })
  const closeInvite = () => { setInvite(null); try { localStorage.removeItem('friend-invite') } catch { /* ignore */ } }
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
      <MilestoneWatcher />
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
      {invite && <FriendsSheet invite={invite} onClose={closeInvite} />}
    </>
  )
}
