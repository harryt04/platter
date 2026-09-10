import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DELETE,
  PATCH,
} from '@/app/api/v1/lists/[listId]/grocery-items/[itemId]/override/route'

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

const manualAddition = {
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
    manualAdditions: [manualAddition],
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
  return {
    params: Promise.resolve({ listId: 'list-1', itemId }),
  }
}

function metadata(operationId: string, baseRevision = 3) {
  return { runId: 'run-1', operationId, clientId: 'client-1', baseRevision }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('PATCH grocery amount override route', () => {
  it('persists a member override while returning the unchanged calculated requirement', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      new Request(
        'http://localhost/api/v1/lists/list-1/grocery-items/item/override',
        {
          method: 'PATCH',
          body: JSON.stringify({
            quantity: { min: '5.25' },
            ...metadata('override-1'),
          }),
        },
      ),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      calculatedRequirement: { min: '2' },
      shoppingAmount: { min: '5.25' },
      revision: 4,
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active', revision: 3 },
      expect.objectContaining({
        $set: expect.objectContaining({
          groceryAmountOverrides: [
            expect.objectContaining({
              itemId: 'grocery:merged:rice:mass:lb',
              quantity: { min: '5.25' },
              calculatedRequirementAtOverride: { min: '2' },
            }),
          ],
        }),
        $push: expect.objectContaining({
          groceryOverrideMutationReceipts: expect.objectContaining({
            operationId: 'override-1',
            kind: 'set',
          }),
        }),
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('replays a completed operation without writing twice', async () => {
    const replay = { revision: 4, shoppingAmount: { min: '5' } }
    const database = databaseFor({
      revision: 4,
      groceryOverrideMutationReceipts: [
        {
          operationId: 'override-replay',
          clientId: 'client-1',
          target: 'grocery-item:grocery:merged:rice:mass:lb:override',
          kind: 'set' as const,
          status: 200 as const,
          response: replay,
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      new Request(
        'http://localhost/api/v1/lists/list-1/grocery-items/item/override',
        {
          method: 'PATCH',
          body: JSON.stringify({
            quantity: { min: '5' },
            ...metadata('override-replay', 4),
          }),
        },
      ),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(replay)
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('rejects stale revisions and non-positive amounts', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const invalid = await PATCH(
      new Request(
        'http://localhost/api/v1/lists/list-1/grocery-items/item/override',
        {
          method: 'PATCH',
          body: JSON.stringify({
            quantity: { min: '0' },
            ...metadata('override-invalid'),
          }),
        },
      ),
      context(),
    )
    expect(invalid.status).toBe(422)

    const stale = await PATCH(
      new Request(
        'http://localhost/api/v1/lists/list-1/grocery-items/item/override',
        {
          method: 'PATCH',
          body: JSON.stringify({
            quantity: { min: '5' },
            ...metadata('override-stale', 2),
          }),
        },
      ),
      context(),
    )
    expect(stale.status).toBe(409)
    expect((await stale.json()).code).toBe('RUN_REVISION_CONFLICT')
  })
})

describe('DELETE grocery amount override route', () => {
  it('resets an override to the current calculated requirement', async () => {
    const database = databaseFor({
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
          createdAt: '2026-09-10T12:00:00.000Z',
          updatedAt: '2026-09-10T12:00:00.000Z',
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await DELETE(
      new Request(
        'http://localhost/api/v1/lists/list-1/grocery-items/item/override',
        {
          method: 'DELETE',
          body: JSON.stringify(metadata('override-reset-1')),
        },
      ),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      calculatedRequirement: { min: '2' },
      shoppingAmount: { min: '2' },
      revision: 4,
      code: 'GROCERY_AMOUNT_RESET',
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'run-1',
        listId: 'list-1',
        state: 'active',
        revision: 3,
        'groceryAmountOverrides.itemId': 'grocery:merged:rice:mass:lb',
      },
      expect.objectContaining({
        $pull: {
          groceryAmountOverrides: { itemId: 'grocery:merged:rice:mass:lb' },
        },
        $push: expect.objectContaining({
          groceryOverrideMutationReceipts: expect.objectContaining({
            operationId: 'override-reset-1',
            kind: 'remove',
          }),
        }),
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('replays a reset without writing twice', async () => {
    const replay = {
      revision: 4,
      shoppingAmount: { min: '2' },
      code: 'GROCERY_AMOUNT_RESET',
    }
    const database = databaseFor({
      revision: 4,
      groceryOverrideMutationReceipts: [
        {
          operationId: 'override-reset-replay',
          clientId: 'client-1',
          target: 'grocery-item:grocery:merged:rice:mass:lb:override',
          kind: 'remove' as const,
          status: 200 as const,
          response: replay,
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await DELETE(
      new Request(
        'http://localhost/api/v1/lists/list-1/grocery-items/item/override',
        {
          method: 'DELETE',
          body: JSON.stringify(metadata('override-reset-replay', 4)),
        },
      ),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(replay)
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
