import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { entityId, isoDateTime } from '@/lib/contracts/ids'
import {
  clearOfflineDatabase,
  clearOfflineSession,
  clearPrivateCaches,
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

  it('clears only reserved private caches while leaving public shell caches intact', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', {
      keys: vi
        .fn()
        .mockResolvedValue([
          'platter-private-user-1-cache',
          'platter-shell-v2',
          'platter-private-user-1-more',
          'platter-private-user-2-cache',
        ]),
      delete: deleteCache,
    })

    await clearPrivateCaches('user-1')

    expect(deleteCache).toHaveBeenCalledTimes(2)
    expect(deleteCache).toHaveBeenCalledWith('platter-private-user-1-cache')
    expect(deleteCache).toHaveBeenCalledWith('platter-private-user-1-more')
    vi.unstubAllGlobals()
  })
})
