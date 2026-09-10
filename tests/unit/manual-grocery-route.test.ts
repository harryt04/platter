import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/lists/[listId]/manual-items/route'
import {
  DELETE,
  PATCH,
} from '@/app/api/v1/lists/[listId]/manual-items/[additionId]/route'

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

function metadata(operationId: string, baseRevision = 3) {
  return { runId: 'run-1', operationId, clientId: 'client-1', baseRevision }
}

function databaseFor(
  currentRun: Record<string, unknown> = {
    _id: 'run-1',
    listId: 'list-1',
    state: 'active',
    revision: 3,
    manualAdditions: [],
  },
) {
  const lists = { findOne: vi.fn().mockResolvedValue(list) }
  const runs = {
    findOne: vi.fn().mockResolvedValue(currentRun),
    findOneAndUpdate: vi.fn().mockResolvedValue(currentRun),
  }
  const collections: Record<string, unknown> = {
    lists,
    shopping_runs: runs,
  }
  return {
    db: { collection: vi.fn((name: string) => collections[name]) },
    runs,
  }
}

function listContext() {
  return { params: Promise.resolve({ listId: 'list-1' }) }
}

function additionContext(additionId = 'manual-1') {
  return {
    params: Promise.resolve({ listId: 'list-1', additionId }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('manual grocery routes', () => {
  it('adds a parsed manual item and records an idempotency receipt', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/manual-items', {
        method: 'POST',
        body: JSON.stringify({
          line: '2 bags spinach',
          ...metadata('manual-create-1'),
        }),
      }),
      listContext(),
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      addition: {
        ingredient: {
          originalText: '2 bags spinach',
          quantity: '2',
          unit: 'bag',
          ingredientName: 'spinach',
          parserConfidence: 'high',
        },
      },
      revision: 4,
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active', revision: 3 },
      expect.objectContaining({
        $push: expect.objectContaining({
          manualAdditions: expect.objectContaining({
            ingredient: expect.objectContaining({ ingredientName: 'spinach' }),
          }),
          manualMutationReceipts: expect.objectContaining({
            operationId: 'manual-create-1',
            kind: 'create',
          }),
        }),
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('replays a repeated create without adding a duplicate', async () => {
    const replay = {
      addition: { id: 'manual-1' },
      revision: 4,
    }
    const database = databaseFor({
      _id: 'run-1',
      listId: 'list-1',
      state: 'active',
      revision: 4,
      manualAdditions: [],
      manualMutationReceipts: [
        {
          operationId: 'manual-replay',
          clientId: 'client-1',
          target: 'manual:create',
          kind: 'create',
          status: 201,
          response: replay,
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/manual-items', {
        method: 'POST',
        body: JSON.stringify({
          line: '2 bags spinach',
          ...metadata('manual-replay', 4),
        }),
      }),
      listContext(),
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(replay)
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('updates and removes only the authorized manual item', async () => {
    const addition = {
      id: 'manual-1',
      ingredient: {
        originalText: '1 bag spinach',
        quantity: '1',
        unit: 'bag',
        ingredientName: 'spinach',
        parserConfidence: 'high' as const,
        optional: false,
      },
      createdAt: '2026-09-10T12:00:00.000Z' as const,
      updatedAt: '2026-09-10T12:00:00.000Z' as const,
    }
    const database = databaseFor({
      _id: 'run-1',
      listId: 'list-1',
      state: 'active',
      revision: 3,
      manualAdditions: [addition],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const updateResponse = await PATCH(
      new Request(
        'http://localhost/api/v1/lists/list-1/manual-items/manual-1',
        {
          method: 'PATCH',
          body: JSON.stringify({
            line: '2 bags spinach',
            ...metadata('manual-update-1'),
          }),
        },
      ),
      additionContext(),
    )

    expect(updateResponse.status).toBe(200)
    expect(await updateResponse.json()).toMatchObject({
      addition: { ingredient: { quantity: '2' } },
      revision: 4,
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'manualAdditions.id': 'manual-1' }),
      expect.objectContaining({
        $set: expect.objectContaining({
          'manualAdditions.$': expect.objectContaining({
            id: 'manual-1',
            ingredient: expect.objectContaining({ quantity: '2' }),
          }),
        }),
      }),
      { returnDocument: 'after' },
    )

    database.runs.findOne.mockResolvedValue({
      _id: 'run-1',
      listId: 'list-1',
      state: 'active',
      revision: 3,
      manualAdditions: [addition],
    })
    const deleteResponse = await DELETE(
      new Request(
        'http://localhost/api/v1/lists/list-1/manual-items/manual-1',
        {
          method: 'DELETE',
          body: JSON.stringify(metadata('manual-remove-1')),
        },
      ),
      additionContext(),
    )

    expect(deleteResponse.status).toBe(200)
    expect(await deleteResponse.json()).toMatchObject({
      code: 'MANUAL_GROCERY_REMOVED',
      additionId: 'manual-1',
      revision: 4,
    })
  })

  it('rejects stale revisions and malformed manual lines', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const invalid = await POST(
      new Request('http://localhost/api/v1/lists/list-1/manual-items', {
        method: 'POST',
        body: JSON.stringify({ line: '   ' }),
      }),
      listContext(),
    )
    expect(invalid.status).toBe(422)
    expect(database.runs.findOne).not.toHaveBeenCalled()

    const stale = await POST(
      new Request('http://localhost/api/v1/lists/list-1/manual-items', {
        method: 'POST',
        body: JSON.stringify({
          line: 'paper towels',
          ...metadata('manual-stale', 2),
        }),
      }),
      listContext(),
    )
    expect(stale.status).toBe(409)
    expect((await stale.json()).code).toBe('RUN_REVISION_CONFLICT')
  })
})
