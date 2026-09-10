import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { entityId, isoDateTime } from '@/lib/contracts/ids'
import {
  clearOfflineDatabase,
  clearOfflineSession,
  getOfflineOperations,
  getOfflineShellSnapshot,
  getOfflineSnapshots,
  getRememberedOfflineUser,
  queueOfflineOperation,
  saveRunSnapshot,
  saveShellSnapshot,
} from '@/lib/offline/database'

const userId = 'offline-signout-test-user'

afterEach(async () => {
  await clearOfflineDatabase(userId)
  window.localStorage.clear()
})

describe('offline sign-out cleanup', () => {
  it('removes the user database and remembered identity before public navigation', async () => {
    await saveShellSnapshot(userId, {
      payload: {
        kind: 'shell',
        lists: [
          { id: 'list-1', name: 'Private family list', status: 'active' },
        ],
      },
      updatedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
    })
    await saveRunSnapshot(userId, {
      listId: 'list-1',
      runId: 'run-1',
      revision: 4,
      payload: {
        kind: 'run',
        listId: 'list-1',
        listName: 'Private family list',
        listStatus: 'active',
        runId: 'run-1',
        revision: 4,
        recipeSelections: [],
        groceryItemCount: 1,
      },
      updatedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
    })
    await queueOfflineOperation(userId, {
      operationId: 'signout-operation',
      clientId: 'client-1',
      listId: entityId('list-1'),
      runId: entityId('run-1'),
      kind: 'grocery.purchased.set',
      payload: { itemId: 'private-item', purchased: true },
    })

    expect(getRememberedOfflineUser()).toBe(userId)

    await clearOfflineSession()

    expect(getRememberedOfflineUser()).toBeNull()
    await expect(getOfflineShellSnapshot(userId)).resolves.toBeUndefined()
    await expect(getOfflineSnapshots(userId)).resolves.toEqual([])
    await expect(getOfflineOperations(userId)).resolves.toEqual([])
  })
})
