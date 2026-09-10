import Dexie, { type Table } from 'dexie'
import type { QueuedOperation } from '@/lib/contracts/mutations'
import { isoDateTime, type IsoDateTime } from '@/lib/contracts/ids'

export type OfflineRecipeSelectionSummary = {
  id: string
  title: string
  desiredPeople: number
}

export type OfflineRunSnapshotPayload = {
  kind: 'run'
  listId: string
  listName: string
  listStatus: 'active' | 'archived'
  runId: string
  revision: number
  recipeSelections: OfflineRecipeSelectionSummary[]
  groceryItemCount: number
}

export type OfflineListSummary = {
  id: string
  name: string
  status: 'active' | 'archived'
}

export type OfflineShellSnapshotPayload = {
  kind: 'shell'
  lists: OfflineListSummary[]
}

export interface RunSnapshot {
  id?: number
  userId: string
  listId: string
  runId: string
  revision: number
  payload: OfflineRunSnapshotPayload
  updatedAt: string
}

export interface ShellSnapshot {
  id?: number
  userId: string
  payload: OfflineShellSnapshotPayload
  updatedAt: string
}

export type OfflineOperationInput = Omit<
  QueuedOperation,
  'createdAt' | 'attemptCount' | 'status'
> & {
  createdAt?: IsoDateTime
}

class PlatterOfflineDatabase extends Dexie {
  snapshots!: Table<RunSnapshot, number>
  shells!: Table<ShellSnapshot, number>
  operations!: Table<QueuedOperation & { id?: number }, number>

  constructor(userId: string) {
    super(`platter-${userId}`)
    this.version(1).stores({
      snapshots: '++id, userId, [userId+listId], runId, updatedAt',
      operations: '++id, operationId, [listId+runId], status, createdAt',
    })
    this.version(2).stores({
      snapshots: '++id, userId, [userId+listId], runId, updatedAt',
      shells: '++id, userId, updatedAt',
      operations: '++id, operationId, [listId+runId], status, createdAt',
    })
  }
}

export function openOfflineDatabase(userId: string) {
  return new PlatterOfflineDatabase(userId)
}

export const offlineUserStorageKey = 'platter-offline-user-id'

export function rememberOfflineUser(userId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(offlineUserStorageKey, userId)
  } catch {
    // Offline snapshots still work when storage access is restricted.
  }
}

export function getRememberedOfflineUser() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(offlineUserStorageKey)
  } catch {
    return null
  }
}

export async function saveRunSnapshot(
  userId: string,
  snapshot: Omit<RunSnapshot, 'id' | 'userId'>,
) {
  rememberOfflineUser(userId)
  const db = openOfflineDatabase(userId)
  await db.transaction('rw', db.snapshots, async () => {
    await db.snapshots
      .where('[userId+listId]')
      .equals([userId, snapshot.listId])
      .delete()
    await db.snapshots.add({ ...snapshot, userId })
  })
  db.close()
}

export async function saveShellSnapshot(
  userId: string,
  snapshot: Omit<ShellSnapshot, 'id' | 'userId'>,
) {
  rememberOfflineUser(userId)
  const db = openOfflineDatabase(userId)
  await db.transaction('rw', db.shells, async () => {
    await db.shells.where('userId').equals(userId).delete()
    await db.shells.add({ ...snapshot, userId })
  })
  db.close()
}

export async function getOfflineSnapshots(userId: string) {
  const db = openOfflineDatabase(userId)
  const snapshots = await db.snapshots.where('userId').equals(userId).toArray()
  db.close()
  return snapshots.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )
}

export async function getOfflineShellSnapshot(userId: string) {
  const db = openOfflineDatabase(userId)
  const snapshots = await db.shells.where('userId').equals(userId).toArray()
  db.close()
  return snapshots.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0]
}

/** Add one retry-safe operation to the authenticated user's local queue. */
export async function queueOfflineOperation(
  userId: string,
  input: OfflineOperationInput,
) {
  rememberOfflineUser(userId)
  const db = openOfflineDatabase(userId)
  try {
    return await db.transaction('rw', db.operations, async () => {
      const existing = await db.operations
        .where('operationId')
        .equals(input.operationId)
        .first()
      if (existing) return existing

      const operation: QueuedOperation = {
        ...input,
        createdAt: input.createdAt ?? isoDateTime(new Date()),
        attemptCount: 0,
        status: 'pending',
      }
      const id = await db.operations.add(operation)
      return { ...operation, id }
    })
  } finally {
    db.close()
  }
}

export async function getOfflineOperations(userId: string) {
  const db = openOfflineDatabase(userId)
  try {
    return await db.operations.orderBy('createdAt').toArray()
  } finally {
    db.close()
  }
}

export async function updateOfflineOperation(
  userId: string,
  operationId: string,
  update: Pick<QueuedOperation, 'status'> &
    Partial<Pick<QueuedOperation, 'attemptCount'>>,
) {
  const db = openOfflineDatabase(userId)
  try {
    const operation = await db.operations
      .where('operationId')
      .equals(operationId)
      .first()
    if (!operation?.id) return false
    await db.operations.update(operation.id, update)
    return true
  } finally {
    db.close()
  }
}

export async function clearOfflineDatabase(userId: string) {
  const db = openOfflineDatabase(userId)
  await db.delete()
  db.close()
}

export async function clearOfflineSession() {
  const userId = getRememberedOfflineUser()
  if (!userId) return
  try {
    await clearOfflineDatabase(userId)
  } finally {
    try {
      window.localStorage.removeItem(offlineUserStorageKey)
    } catch {
      // The database is still removed even if local storage is unavailable.
    }
  }
}
