import { Cloud, CloudOff, LoaderCircle } from 'lucide-react'
import type { SyncState } from '@/lib/offline/status'
import { syncStateCopy } from '@/lib/offline/status'

export function SyncStatus({ state }: { state: SyncState }) {
  const Icon =
    state === 'offline' ? CloudOff : state === 'syncing' ? LoaderCircle : Cloud
  return (
    <span
      className="text-muted-foreground inline-flex items-center gap-2 text-xs"
      title={syncStateCopy[state]}
    >
      <Icon
        size={15}
        className={state === 'syncing' ? 'animate-spin' : undefined}
      />
      <span>
        {state === 'offline'
          ? 'Offline'
          : state === 'pending'
            ? 'Pending sync'
            : state === 'failed'
              ? 'Sync needs attention'
              : state === 'syncing'
                ? 'Syncing'
                : 'Synced'}
      </span>
    </span>
  )
}
