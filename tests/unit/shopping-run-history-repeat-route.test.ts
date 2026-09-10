import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/lists/[listId]/history/[runId]/repeat/route'

const { getSession, getConnectedDatabase, publishRunMutationEvent } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    getConnectedDatabase: vi.fn(),
    publishRunMutationEvent: vi.fn(),
  }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/realtime/events', () => ({ publishRunMutationEvent }))

const list = {
  _id: 'list-1',
  status: 'active' as const,
  activeRunId: 'run-current',
  members: [
    {
      userId: 'user-1',
      role: 'owner' as const,
      invitationState: 'active' as const,
    },
  ],
}

const currentRun = {
  _id: 'run-current',
  listId: 'list-1',
  state: 'active' as const,
  revision: 4,
  recipeSelections: [],
  selectionMutationReceipts: [] as Array<Record<string, unknown>>,
}

const history = {
  _id: 'history-1',
  listId: 'list-1',
  completedAt: '2026-09-10T18:00:00.000Z',
  localDate: '2026-09-10',
  completedByUserId: 'user-1',
  recipeSelections: [
    {
      _id: 'old-selection',
      recipeId: 'recipe-1',
      versionId: 'version-3',
      versionNumber: 3,
      desiredPeople: 6,
    },
  ],
}

const recipe = {
  _id: 'recipe-1',
  recipeId: 'recipe-1',
  ownerId: 'user-1',
  status: 'usable' as const,
  visibility: 'private' as const,
}

const version = {
  _id: 'version-3',
  recipeId: 'recipe-1',
  versionNumber: 3,
  ownerId: 'user-1',
  title: 'Citrus tacos',
  status: 'usable' as const,
  visibility: 'private' as const,
  typicalPeopleFed: 4,
  ingredients: [
    {
      originalText: '1 lime',
      quantity: '1',
      unit: 'each',
      ingredientName: 'lime',
      optional: false,
    },
  ],
  instructions: [],
}

function databaseFor(run = currentRun) {
  const lists = { findOne: vi.fn().mockResolvedValue(list) }
  const runs = {
    findOne: vi.fn().mockResolvedValue(run),
    findOneAndUpdate: vi.fn().mockResolvedValue({ ...run, revision: 5 }),
  }
  const histories = { findOne: vi.fn().mockResolvedValue(history) }
  const recipes = { findOne: vi.fn().mockResolvedValue(recipe) }
  const shares = { findOne: vi.fn().mockResolvedValue(null) }
  const versions = { findOne: vi.fn().mockResolvedValue(version) }
  const collections: Record<string, unknown> = {
    lists,
    shopping_runs: runs,
    shopping_run_history: histories,
    recipes,
    recipe_shares: shares,
    recipe_versions: versions,
  }
  return {
    db: { collection: vi.fn((name: string) => collections[name]) },
    runs,
    histories,
    recipes,
  }
}

function context() {
  return { params: Promise.resolve({ listId: 'list-1', runId: 'history-1' }) }
}

function request(body: Record<string, unknown>) {
  return new Request(
    'http://localhost/api/v1/lists/list-1/history/history-1/repeat',
    { method: 'POST', body: JSON.stringify(body) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
  publishRunMutationEvent.mockResolvedValue(undefined)
})

describe('POST /api/v1/lists/[listId]/history/[runId]/repeat', () => {
  it('adds the pinned historical version with its original people count', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      request({
        operationId: 'repeat-1',
        clientId: 'client-1',
        runId: 'run-current',
        baseRevision: 4,
      }),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      historyId: 'history-1',
      addedCount: 1,
      revision: 5,
      selections: [
        {
          recipeId: 'recipe-1',
          versionId: 'version-3',
          versionNumber: 3,
          desiredPeople: 6,
          scaleFactor: '1.5',
        },
      ],
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'run-current',
        listId: 'list-1',
        state: 'active',
        revision: 4,
      },
      expect.objectContaining({
        $push: {
          recipeSelections: {
            $each: [expect.objectContaining({ desiredPeople: 6 })],
          },
          selectionMutationReceipts: expect.objectContaining({
            kind: 'repeat-history',
            target: 'history:history-1',
          }),
        },
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('replays the receipt without resolving or adding the history again', async () => {
    const replay = {
      historyId: 'history-1',
      addedCount: 1,
      selections: [],
      revision: 5,
    }
    const database = databaseFor({
      ...currentRun,
      selectionMutationReceipts: [
        {
          operationId: 'repeat-replay',
          clientId: 'client-1',
          target: 'history:history-1',
          kind: 'repeat-history',
          status: 200,
          response: replay,
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      request({ operationId: 'repeat-replay', clientId: 'client-1' }),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(replay)
    expect(database.histories.findOne).not.toHaveBeenCalled()
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('does not add a historical version that is no longer accessible', async () => {
    const database = databaseFor()
    database.recipes.findOne.mockResolvedValue(null)
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      request({ operationId: 'repeat-private', clientId: 'client-1' }),
      context(),
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('RECIPE_VERSION_UNAVAILABLE')
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
