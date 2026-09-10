import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/v1/lists/[listId]/grocery-items/[itemId]/category/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

function context(itemId = 'grocery:merged:rice:mass:lb') {
  return { params: Promise.resolve({ listId: 'list-1', itemId }) }
}

function request(body: unknown) {
  return new Request(
    'http://localhost/api/v1/lists/list-1/grocery-items/item/category',
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

function databaseFor(categoryOverrides: unknown[] = []) {
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
        id: 'manual-1',
        ingredient: {
          originalText: '2 lb rice',
          quantity: '2',
          unit: 'lb',
          ingredientName: 'rice',
          parserConfidence: 'high' as const,
          optional: false,
        },
        createdAt: '2026-09-10T12:00:00.000Z',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
    ],
    groceryAmountOverrides: [],
    groceryCategoryOverrides: categoryOverrides,
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

describe('grocery category route', () => {
  it('persists an authorized, revision-aware category change', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request({
        category: 'pantry',
        runId: 'run-1',
        operationId: 'category-1',
        clientId: 'client-1',
        baseRevision: 3,
      }),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      category: 'pantry',
      revision: 4,
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active', revision: 3 },
      expect.objectContaining({
        $set: {
          groceryCategoryOverrides: [
            expect.objectContaining({
              itemId: 'grocery:merged:rice:mass:lb',
              category: 'pantry',
            }),
          ],
        },
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('rejects unknown categories without disclosing the run', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      request({
        category: 'secret aisle',
        runId: 'run-1',
        operationId: 'category-1',
        clientId: 'client-1',
      }),
      context(),
    )

    expect(response.status).toBe(422)
    expect(database.runs.findOne).not.toHaveBeenCalled()
  })
})
