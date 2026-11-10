'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SyncStatus } from '@/components/states/sync-status'
import { synchronizeOfflineOperations } from '@/lib/offline/sync'

type State = 'syncing' | 'synced' | 'failed'

export function OfflineMutationSync({ userId }: { userId: string }) {
  const router = useRouter()
  const [state, setState] = useState<State | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const initialSyncStarted = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    let running = false
    mounted.current = true

    const synchronize = async () => {
      if (running || !navigator.onLine) return
      running = true
      setState('syncing')
      setMessage(null)
      try {
        const result = await synchronizeOfflineOperations(userId)
        if (!mounted.current) return
        if (result.attempted === 0) {
          setState(null)
          return
        }
        setState(result.failed > 0 ? 'failed' : 'synced')
        setMessage(
          result.completedRunOperations > 0
            ? 'This shopping run was completed on another device. Showing the latest shared list.'
            : result.failed > 0
              ? 'Some offline changes need attention. The shared list was refreshed.'
              : 'Offline changes are synced. Showing the latest shared list.',
        )
        router.refresh()
      } catch {
        if (!mounted.current) return
        setState('failed')
        setMessage('Offline changes need attention. Reconnect and try again.')
      } finally {
        running = false
      }
    }

    const handleOnline = () => void synchronize()
    window.addEventListener('online', handleOnline)
    if (!initialSyncStarted.current) {
      initialSyncStarted.current = true
      void synchronize()
    }
    return () => {
      mounted.current = false
      window.removeEventListener('online', handleOnline)
    }
  }, [router, userId])

  if (!state) return null
  return (
    <div
      aria-live="polite"
      className="text-muted-foreground flex items-center gap-2 border-b px-4 py-2 text-xs md:px-8"
      role="status"
    >
      <SyncStatus state={state} />
      {message && <span>{message}</span>}
    </div>
  )
}
