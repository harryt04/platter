import Dexie, { type Table } from 'dexie'
import type { QueuedOperation } from '@/lib/contracts/mutations'

export interface RunSnapshot {
  id?: number
  userId: string
  listId: string
  runId: string
  revision: number
  payload: unknown
  updatedAt: string
}

class PlatterOfflineDatabase extends Dexie {
  snapshots!: Table<RunSnapshot, number>
  operations!: Table<QueuedOperation & { id?: number }, number>

  constructor(userId: string) {
    super(`platter-${userId}`)
    this.version(1).stores({
      snapshots: '++id, [userId+listId], runId, updatedAt',
      operations: '++id, operationId, [listId+runId], status, createdAt',
    })
  }
}

export function openOfflineDatabase(userId: string) {
  return new PlatterOfflineDatabase(userId)
}

export async function clearOfflineDatabase(userId: string) {
  const db = openOfflineDatabase(userId)
  await db.delete()
  db.close()
}
