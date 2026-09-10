export type SyncState = 'offline' | 'pending' | 'syncing' | 'synced' | 'failed'

export const syncStateCopy: Record<SyncState, string> = {
  offline: 'Offline. Changes stay on this device until you reconnect.',
  pending: 'Saved on this device. We’ll sync it when you’re back online.',
  syncing: 'Syncing your latest changes.',
  synced: 'Synced with the shared list.',
  failed: 'This change needs attention before it can sync.',
}
