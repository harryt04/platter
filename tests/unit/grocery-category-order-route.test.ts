import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/v1/lists/[listId]/grocery-categories/order/route'
import type { GroceryCategoryOrderMutationReceipt } from '@/lib/recipes/grocery-category-ordering'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

function request(body: unknown) {
  return new Request(
    'http://localhost/api/v1/lists/list-1/grocery-categories/order',
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
        id: 'manual-milk',
        ingredient: {
          originalText: '1 milk',
          quantity: '1',
          unit: '',
          ingredientName: 'milk',
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
    categoryOrdering: [],
    groceryCategoryOrderMutationReceipts:
      [] as GroceryCategoryOrderMutationReceipt[],
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
    run,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('grocery category order route', () => {
  it('persists a revision-aware category move', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)
    const body = {
      category: 'dairy-eggs',
      targetCategory: 'produce',
      placement: 'before',
      operationId: 'category-order-1',
      clientId: 'client-1',
      baseRevision: 3,
    }

    const response = await PATCH(request(body), {
      params: Promise.resolve({ listId: 'list-1' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      revision: 4,
      code: 'GROCERY_CATEGORY_ORDER_CHANGED',
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active', revision: 3 },
      expect.objectContaining({
        $set: { categoryOrdering: ['dairy-eggs', 'produce'] },
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )

    database.run.groceryCategoryOrderMutationReceipts.push({
      operationId: body.operationId,
      clientId: body.clientId,
      target: 'grocery-category:dairy-eggs:order',
      kind: 'move',
      status: 200,
      response: {
        revision: 4,
        code: 'GROCERY_CATEGORY_ORDER_CHANGED',
      },
    })
    const retry = await PATCH(request(body), {
      params: Promise.resolve({ listId: 'list-1' }),
    })
    expect(await retry.json()).toMatchObject({ revision: 4 })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledTimes(1)
  })

  it('rejects stale category ordering mutations', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request({
        category: 'dairy-eggs',
        targetCategory: 'produce',
        placement: 'before',
        operationId: 'category-order-1',
        clientId: 'client-1',
        baseRevision: 2,
      }),
      { params: Promise.resolve({ listId: 'list-1' }) },
    )

    expect(response.status).toBe(409)
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
