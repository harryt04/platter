import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/v1/lists/[listId]/grocery-items/[itemId]/order/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

function context(itemId = 'grocery:merged:onion:count:each') {
  return { params: Promise.resolve({ listId: 'list-1', itemId }) }
}

function request(body: unknown) {
  return new Request(
    'http://localhost/api/v1/lists/list-1/grocery-items/item/order',
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

function databaseFor() {
  const list = {
    _id: 'list-1',
    status: 'active' as const,
    activeRunId: 'run-1',
    members: [{ userId: 'user-1', role: 'owner', invitationState: 'active' }],
  }
  const run = {
    _id: 'run-1',
    listId: 'list-1',
    state: 'active' as const,
    revision: 3,
    recipeSelections: [],
    manualAdditions: [
      {
        id: 'manual-apple',
        ingredient: {
          originalText: '2 apples',
          quantity: '2',
          unit: '',
          ingredientName: 'apple',
          parserConfidence: 'high' as const,
          optional: false,
        },
        createdAt: '2026-09-10T12:00:00.000Z',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
      {
        id: 'manual-onion',
        ingredient: {
          originalText: '2 onions',
          quantity: '2',
          unit: '',
          ingredientName: 'onion',
          parserConfidence: 'high' as const,
          optional: false,
        },
        createdAt: '2026-09-10T12:00:00.000Z',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
    ],
    groceryAmountOverrides: [],
    groceryCategoryOverrides: [],
    ordering: [],
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
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('grocery item order route', () => {
  it('persists an authorized, revision-aware move within a category', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request({
        direction: 'up',
        operationId: 'order-1',
        clientId: 'client-1',
        baseRevision: 3,
      }),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      revision: 4,
      code: 'GROCERY_ORDER_CHANGED',
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active', revision: 3 },
      expect.objectContaining({
        $set: {
          ordering: [
            'grocery:merged:onion:count:each',
            'grocery:merged:apple:count:each',
          ],
        },
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('rejects stale mutations before changing the run', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request({
        direction: 'up',
        operationId: 'order-1',
        clientId: 'client-1',
        baseRevision: 2,
      }),
      context(),
    )

    expect(response.status).toBe(409)
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
