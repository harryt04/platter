import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DELETE,
  PATCH,
} from '@/app/api/v1/lists/[listId]/grocery-items/[itemId]/purchased/route'

const { getSession, getConnectedDatabase, publishRunMutationEvent } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    getConnectedDatabase: vi.fn(),
    publishRunMutationEvent: vi.fn().mockResolvedValue(undefined),
  }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/realtime/events', () => ({ publishRunMutationEvent }))

const list = {
  _id: 'list-1',
  status: 'active' as const,
  activeRunId: 'run-1',
  members: [
    {
      userId: 'user-1',
      role: 'owner' as const,
      invitationState: 'active' as const,
    },
  ],
}

const addition = {
  id: 'manual-1',
  ingredient: {
    originalText: '2 lb rice',
    quantity: '2',
    unit: 'lb',
    ingredientName: 'rice',
    parserConfidence: 'high' as const,
    optional: false,
  },
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

function databaseFor(currentRun: Record<string, unknown> = {}) {
  const run = {
    _id: 'run-1',
    listId: 'list-1',
    state: 'active' as const,
    revision: 3,
    recipeSelections: [],
    manualAdditions: [addition],
    groceryAmountOverrides: [],
    groceryCategoryOverrides: [],
    purchasedItems: [],
    ...currentRun,
  }
  const runs = {
    findOne: vi.fn().mockResolvedValue(run),
    findOneAndUpdate: vi.fn().mockResolvedValue(run),
  }
  const collections: Record<string, unknown> = {
    lists: { findOne: vi.fn().mockResolvedValue(list) },
    shopping_runs: runs,
    recipe_versions: { find: vi.fn() },
  }
  return {
    db: { collection: vi.fn((name: string) => collections[name]) },
    runs,
    list,
  }
}

function context(itemId = 'grocery:merged:rice:mass:lb') {
  return { params: Promise.resolve({ listId: 'list-1', itemId }) }
}

function request(method: string, body: unknown) {
  return new Request('http://localhost/api/purchased', {
    method,
    body: JSON.stringify(body),
  })
}

function metadata(operationId: string, baseRevision = 3) {
  return { runId: 'run-1', operationId, clientId: 'client-1', baseRevision }
}

beforeEach(() => {
  vi.clearAllMocks()
  list.activeRunId = 'run-1'
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('purchased grocery route', () => {
  it('marks a current item and records the acting member', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request('PATCH', metadata('purchased-1')),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      purchased: true,
      revision: 4,
      detail: 'Marked rice purchased.',
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active', revision: 3 },
      expect.objectContaining({
        $set: {
          purchasedItems: [
            expect.objectContaining({
              itemId: 'grocery:merged:rice:mass:lb',
              markedByUserId: 'user-1',
            }),
          ],
        },
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
    expect(publishRunMutationEvent).toHaveBeenCalledWith(
      database.db,
      expect.objectContaining({
        type: 'grocery.purchased.marked',
        listId: 'list-1',
        runId: 'run-1',
        revision: 4,
        operationId: 'purchased-1',
        actorId: 'user-1',
      }),
    )
  })

  it('rejects a write carrying the completed run id before reading or changing it', async () => {
    const database = databaseFor()
    database.list.activeRunId = 'run-2'
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request('PATCH', metadata('completed-run-write')),
      context(),
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'RUN_COMPLETED',
      detail:
        'This shopping run was completed on another device. Refresh to use the new active run.',
    })
    expect(database.runs.findOne).not.toHaveBeenCalled()
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('keeps purchased separate from already-have and makes repeated checks idempotent', async () => {
    const database = databaseFor({
      purchasedItems: [
        {
          itemId: 'grocery:merged:rice:mass:lb',
          markedByUserId: 'user-2',
          createdAt: '2026-09-10T12:00:00.000Z',
          updatedAt: '2026-09-10T12:00:00.000Z',
        },
      ],
      alreadyHaveItems: [
        {
          itemId: 'grocery:merged:rice:mass:lb',
          createdAt: '2026-09-10T12:00:00.000Z',
          updatedAt: '2026-09-10T12:00:00.000Z',
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request('PATCH', metadata('purchased-repeat')),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      purchased: true,
      revision: 3,
    })
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('undoes a purchase and replays a recorded mutation without changing it twice', async () => {
    const database = databaseFor({
      purchasedItems: [
        {
          itemId: 'grocery:merged:rice:mass:lb',
          markedByUserId: 'user-1',
          createdAt: '2026-09-10T12:00:00.000Z',
          updatedAt: '2026-09-10T12:00:00.000Z',
        },
      ],
      groceryPurchasedMutationReceipts: [
        {
          operationId: 'purchased-replay',
          clientId: 'client-1',
          target: 'grocery-item:grocery:merged:rice:mass:lb:purchased',
          kind: 'remove' as const,
          status: 200 as const,
          response: {
            purchased: false,
            revision: 4,
            detail: 'Unmarked rice as purchased.',
            code: 'GROCERY_PURCHASED_UNDONE',
          },
        },
      ],
      revision: 4,
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const replay = await DELETE(
      request('DELETE', metadata('purchased-replay', 4)),
      context(),
    )
    expect(replay.status).toBe(200)
    expect(await replay.json()).toEqual({
      purchased: false,
      revision: 4,
      detail: 'Unmarked rice as purchased.',
      code: 'GROCERY_PURCHASED_UNDONE',
    })
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()

    const undoneDatabase = databaseFor({
      purchasedItems: [
        {
          itemId: 'grocery:merged:rice:mass:lb',
          markedByUserId: 'user-1',
          createdAt: '2026-09-10T12:00:00.000Z',
          updatedAt: '2026-09-10T12:00:00.000Z',
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(undoneDatabase.db)
    const response = await DELETE(
      request('DELETE', metadata('purchased-undo')),
      context(),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      purchased: false,
      detail: 'Unmarked rice as purchased.',
    })
    expect(undoneDatabase.runs.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'purchasedItems.itemId': 'grocery:merged:rice:mass:lb',
      }),
      expect.objectContaining({
        $pull: { purchasedItems: { itemId: 'grocery:merged:rice:mass:lb' } },
      }),
      { returnDocument: 'after' },
    )
    expect(publishRunMutationEvent).toHaveBeenCalledWith(
      undoneDatabase.db,
      expect.objectContaining({
        type: 'grocery.purchased.undone',
        revision: 4,
        operationId: 'purchased-undo',
      }),
    )
  })

  it('returns a stable retryable problem when storage fails', async () => {
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await PATCH(
      request('PATCH', metadata('purchased-storage-failure')),
      context(),
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(await response.json()).toEqual({
      type: 'https://platter.dev/problems/purchased-state-unavailable',
      title: 'Purchased state temporarily unavailable',
      status: 503,
      detail:
        'The purchased state is temporarily unavailable. Try again shortly.',
      code: 'PURCHASED_STATE_UNAVAILABLE',
    })
  })

  it('does not replay malformed persisted mutation responses', async () => {
    const database = databaseFor({
      groceryPurchasedMutationReceipts: [
        {
          operationId: 'malformed-replay',
          clientId: 'client-1',
          target: 'grocery-item:grocery:merged:rice:mass:lb:purchased',
          kind: 'set' as const,
          status: 200 as const,
          response: { purchased: true, revision: 'not-a-number' },
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request('PATCH', metadata('malformed-replay')),
      context(),
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'PURCHASED_STATE_UNAVAILABLE',
    })
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
