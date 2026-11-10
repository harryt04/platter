import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DELETE,
  PATCH,
} from '@/app/api/v1/lists/[listId]/grocery-items/[itemId]/already-have/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const list = {
  _id: 'list-1',
  name: 'Family',
  ownerIds: ['user-1'],
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
    ...currentRun,
  }
  const lists = { findOne: vi.fn().mockResolvedValue(list) }
  const runs = {
    findOne: vi.fn().mockResolvedValue(run),
    findOneAndUpdate: vi.fn().mockResolvedValue(run),
  }
  const collections: Record<string, unknown> = {
    lists,
    shopping_runs: runs,
    recipe_versions: { find: vi.fn() },
  }
  return {
    db: { collection: vi.fn((name: string) => collections[name]) },
    runs,
  }
}

function context(itemId = 'grocery:merged:rice:mass:lb') {
  return { params: Promise.resolve({ listId: 'list-1', itemId }) }
}

function metadata(operationId: string, baseRevision = 3) {
  return { runId: 'run-1', operationId, clientId: 'client-1', baseRevision }
}

function request(method: string, body: unknown) {
  return new Request(
    'http://localhost/api/v1/lists/list-1/grocery-items/item/already-have',
    { method, body: JSON.stringify(body) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('already-have grocery route', () => {
  it('marks a current item without changing its calculated grocery facts', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request('PATCH', metadata('already-have-1')),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      alreadyHave: true,
      revision: 4,
      detail: 'Marked rice already have. It’s hidden from your buy view.',
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active', revision: 3 },
      expect.objectContaining({
        $set: {
          alreadyHaveItems: [
            expect.objectContaining({ itemId: expect.any(String) }),
          ],
        },
        $push: expect.objectContaining({
          groceryAlreadyHaveMutationReceipts: expect.objectContaining({
            operationId: 'already-have-1',
            kind: 'set',
          }),
        }),
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('undoes the state while leaving the shopping override untouched', async () => {
    const database = databaseFor({
      alreadyHaveItems: [
        {
          itemId: 'grocery:merged:rice:mass:lb',
          createdAt: '2026-09-10T12:00:00.000Z',
          updatedAt: '2026-09-10T12:00:00.000Z',
        },
      ],
      groceryAmountOverrides: [
        {
          itemId: 'grocery:merged:rice:mass:lb',
          quantity: { min: '5.25' },
          preservedItem: {
            ingredientName: 'rice',
            normalizedIdentity: 'rice',
            dimension: 'mass',
            unit: { name: 'lb', dimension: 'mass' },
          },
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await DELETE(
      request('DELETE', metadata('already-have-undo-1')),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      alreadyHave: false,
      revision: 4,
      detail: 'Added rice back to your buy view.',
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'run-1',
        listId: 'list-1',
        state: 'active',
        revision: 3,
        'alreadyHaveItems.itemId': 'grocery:merged:rice:mass:lb',
      },
      expect.objectContaining({
        $pull: { alreadyHaveItems: { itemId: 'grocery:merged:rice:mass:lb' } },
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('replays a mark operation and rejects stale revisions', async () => {
    const replay = {
      alreadyHave: true,
      revision: 4,
      code: 'GROCERY_ALREADY_HAVE',
    }
    const database = databaseFor({
      revision: 4,
      groceryAlreadyHaveMutationReceipts: [
        {
          operationId: 'already-have-replay',
          clientId: 'client-1',
          target: 'grocery-item:grocery:merged:rice:mass:lb:already-have',
          kind: 'set' as const,
          status: 200 as const,
          response: replay,
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const replayResponse = await PATCH(
      request('PATCH', metadata('already-have-replay', 4)),
      context(),
    )
    expect(replayResponse.status).toBe(200)
    expect(await replayResponse.json()).toEqual(replay)
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()

    const staleResponse = await PATCH(
      request('PATCH', metadata('already-have-stale', 3)),
      context(),
    )
    expect(staleResponse.status).toBe(409)
  })
})
