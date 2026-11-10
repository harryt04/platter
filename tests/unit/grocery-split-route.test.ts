import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/lists/[listId]/grocery-items/[itemId]/split/route'

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

const additions = [
  {
    id: 'manual-a',
    ingredient: {
      originalText: '2 cups onions',
      quantity: '2',
      unit: 'cup',
      ingredientName: 'onions',
      parserConfidence: 'high' as const,
      optional: false,
    },
  },
  {
    id: 'manual-b',
    ingredient: {
      originalText: '1 cup onions',
      quantity: '1',
      unit: 'cup',
      ingredientName: 'onions',
      parserConfidence: 'high' as const,
      optional: false,
    },
  },
]

function databaseFor(currentRun: Record<string, unknown> = {}) {
  const run = {
    _id: 'run-1',
    listId: 'list-1',
    state: 'active' as const,
    revision: 3,
    recipeSelections: [],
    manualAdditions: additions,
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

function context(itemId = 'grocery:merged:onions:volume:cup') {
  return { params: Promise.resolve({ listId: 'list-1', itemId }) }
}

function metadata(operationId: string, baseRevision = 3) {
  return { runId: 'run-1', operationId, clientId: 'client-1', baseRevision }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('POST grocery merge split route', () => {
  it('persists one contribution split without changing recipe or manual facts', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request(
        'http://localhost/api/v1/lists/list-1/grocery-items/item/split',
        {
          method: 'POST',
          body: JSON.stringify({
            contributionId: 'manual:manual-a',
            ...metadata('split-1'),
          }),
        },
      ),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      code: 'GROCERY_MERGE_SPLIT',
      split: {
        itemId: 'grocery:merged:onions:volume:cup',
        contributionId: 'manual:manual-a',
      },
      revision: 4,
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active', revision: 3 },
      expect.objectContaining({
        $set: {
          groceryMergeSplits: [
            expect.objectContaining({ contributionId: 'manual:manual-a' }),
          ],
          updatedAt: expect.any(String),
        },
        $push: expect.objectContaining({
          grocerySplitMutationReceipts: expect.objectContaining({
            operationId: 'split-1',
            kind: 'split',
          }),
        }),
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('replays a split receipt without writing twice', async () => {
    const replay = { code: 'GROCERY_MERGE_SPLIT', revision: 4 }
    const database = databaseFor({
      revision: 4,
      grocerySplitMutationReceipts: [
        {
          operationId: 'split-replay',
          clientId: 'client-1',
          target:
            'grocery-item:grocery:merged:onions:volume:cup:split:manual:manual-a',
          kind: 'split' as const,
          status: 200 as const,
          response: replay,
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request(
        'http://localhost/api/v1/lists/list-1/grocery-items/item/split',
        {
          method: 'POST',
          body: JSON.stringify({
            contributionId: 'manual:manual-a',
            ...metadata('split-replay', 4),
          }),
        },
      ),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(replay)
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('rejects a contribution that is not part of the merged item', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request(
        'http://localhost/api/v1/lists/list-1/grocery-items/item/split',
        {
          method: 'POST',
          body: JSON.stringify({
            contributionId: 'manual-missing',
            ...metadata('split-missing'),
          }),
        },
      ),
      context(),
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('GROCERY_CONTRIBUTION_NOT_FOUND')
  })
})
