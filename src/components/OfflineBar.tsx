import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { flushQueue, onQueueChange, readQueue } from '../lib/offline'
import { useToast } from './ui'

/** Shows when you are offline or have entries waiting, and syncs them as soon as the connection is back. */
export default function OfflineBar() {
  const { bump } = useStore()
  const toast = useToast()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [pending, setPending] = useState(() => readQueue().length)

  useEffect(() => {
    const sync = async () => {
      const sent = await flushQueue(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null)
      if (sent) { toast(`☁️ Synced ${sent} offline entr${sent === 1 ? 'y' : 'ies'}`); bump() }
    }
    const up = () => { setOnline(true); sync() }
    const down = () => setOnline(false)
    const off = onQueueChange(() => setPending(readQueue().length))
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    sync()
    const t = setInterval(() => { if (readQueue().length) sync() }, 30000)
    return () => { off(); clearInterval(t); window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [bump, toast])

  if (online && !pending) return null
  return (
    <div className={`offline-bar${online ? ' syncing' : ''}`} role="status">
      {online
        ? <>☁️ Syncing {pending} offline entr{pending === 1 ? 'y' : 'ies'}…</>
        : <>📴 Offline. Keep logging, Pip saves it{pending ? ` (${pending} waiting)` : ''} and syncs when you're back.</>}
    </div>
  )
}
