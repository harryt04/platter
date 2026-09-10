import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { entityId, isoDateTime } from '@/lib/contracts/ids'
import {
  clearOfflineDatabase,
  getOfflineOperations,
  queueOfflineOperation,
  updateOfflineOperation,
} from '@/lib/offline/database'

const userId = 'offline-queue-test-user'
const input = {
  operationId: 'operation-1',
  clientId: 'client-1',
  listId: entityId('list-1'),
  runId: entityId('run-1'),
  kind: 'grocery.purchased.set',
  payload: { itemId: 'grocery:rice', purchased: true },
  baseRevision: 4,
  createdAt: isoDateTime('2026-09-10T12:00:00.000Z'),
}

afterEach(async () => {
  await clearOfflineDatabase(userId)
})

describe('offline operation storage', () => {
  it('stores the required retry metadata and does not duplicate an operation id', async () => {
    const first = await queueOfflineOperation(userId, input)
    const duplicate = await queueOfflineOperation(userId, input)

    expect(duplicate.id).toBe(first.id)
    await expect(getOfflineOperations(userId)).resolves.toEqual([
      expect.objectContaining({
        ...input,
        attemptCount: 0,
        status: 'pending',
      }),
    ])
  })

  it('tracks syncing, failed, and synced state transitions', async () => {
    await queueOfflineOperation(userId, input)

    await expect(
      updateOfflineOperation(userId, input.operationId, {
        status: 'syncing',
        attemptCount: 1,
      }),
    ).resolves.toBe(true)
    await expect(
      updateOfflineOperation(userId, input.operationId, { status: 'failed' }),
    ).resolves.toBe(true)
    await expect(
      updateOfflineOperation(userId, input.operationId, { status: 'synced' }),
    ).resolves.toBe(true)

    await expect(getOfflineOperations(userId)).resolves.toEqual([
      expect.objectContaining({
        operationId: input.operationId,
        attemptCount: 1,
        status: 'synced',
      }),
    ])
  })
})
