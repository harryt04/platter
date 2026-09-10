import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QueuedOperation } from '@/lib/contracts/mutations'
import { isoDateTime } from '@/lib/contracts/ids'
import { synchronizeOfflineOperations } from '@/lib/offline/sync'

const offline = vi.hoisted(() => ({
  getOfflineOperations: vi.fn(),
  updateOfflineOperation: vi.fn(),
}))

vi.mock('@/lib/offline/database', () => offline)

function operation(overrides: Partial<QueuedOperation> = {}): QueuedOperation {
  return {
    operationId: 'operation-1',
    clientId: 'client-1',
    listId: 'list-1' as QueuedOperation['listId'],
    runId: 'run-1' as QueuedOperation['runId'],
    kind: 'grocery.purchased.set',
    payload: { itemId: 'item-1', purchased: true },
    baseRevision: 4,
    createdAt: isoDateTime('2026-09-10T12:00:00.000Z'),
    attemptCount: 0,
    status: 'pending',
    ...overrides,
  }
}

function accepted(revision: number) {
  return new Response(JSON.stringify({ revision }), { status: 200 })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('offline mutation synchronization', () => {
  it('coalesces same-field changes and advances revisions for unrelated changes', async () => {
    const older = operation({ operationId: 'older' })
    const latest = operation({
      operationId: 'latest',
      kind: 'grocery.purchased.undo',
      payload: { itemId: 'item-1', purchased: false },
      createdAt: isoDateTime('2026-09-10T12:00:01.000Z'),
    })
    const other = operation({
      operationId: 'other',
      kind: 'grocery.already-have.set',
      payload: { itemId: 'item-2', alreadyHave: true },
      createdAt: isoDateTime('2026-09-10T12:00:02.000Z'),
    })
    offline.getOfflineOperations.mockResolvedValue([older, latest, other])
    const request = vi
      .fn()
      .mockResolvedValueOnce(accepted(5))
      .mockResolvedValueOnce(accepted(6))

    await expect(
      synchronizeOfflineOperations('user-1', request),
    ).resolves.toEqual({ attempted: 2, synced: 2, failed: 0 })

    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/api/v1/lists/list-1/grocery-items/item-1/purchased',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(JSON.parse(request.mock.calls[0][1].body as string)).toEqual({
      operationId: 'latest',
      clientId: 'client-1',
      baseRevision: 4,
    })
    expect(JSON.parse(request.mock.calls[1][1].body as string)).toEqual({
      operationId: 'other',
      clientId: 'client-1',
      baseRevision: 5,
    })
    expect(offline.updateOfflineOperation).toHaveBeenCalledWith(
      'user-1',
      'older',
      expect.objectContaining({
        status: 'synced',
        syncMessage: 'Replaced by your latest offline change.',
      }),
    )
  })

  it('replays the latest intent without a stale revision after a remote change', async () => {
    const operationToRetry = operation()
    offline.getOfflineOperations.mockResolvedValue([operationToRetry])
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'RUN_REVISION_CONFLICT',
            detail: 'Shopping run changed',
          }),
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(accepted(9))

    await expect(
      synchronizeOfflineOperations('user-1', request),
    ).resolves.toEqual({ attempted: 1, synced: 1, failed: 0 })

    expect(request).toHaveBeenCalledTimes(2)
    expect(JSON.parse(request.mock.calls[1][1].body as string)).toEqual({
      operationId: 'operation-1',
      clientId: 'client-1',
    })
  })

  it('keeps failed operations visible with a permission explanation', async () => {
    offline.getOfflineOperations.mockResolvedValue([operation()])
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'LIST_NOT_FOUND',
          detail: 'That list is not available to you.',
        }),
        { status: 404 },
      ),
    )

    await expect(
      synchronizeOfflineOperations('user-1', request),
    ).resolves.toEqual({ attempted: 1, synced: 0, failed: 1 })
    expect(offline.updateOfflineOperation).toHaveBeenLastCalledWith(
      'user-1',
      'operation-1',
      expect.objectContaining({
        status: 'failed',
        syncMessage: 'That list is not available to you.',
      }),
    )
  })
})
