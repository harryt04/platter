import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/lists/[listId]/complete/route'

const { getSession, getConnectedDatabase, getMongoClient } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
  getMongoClient: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({
  getConnectedDatabase,
  getMongoClient,
}))

const owner = {
  userId: 'user-1',
  role: 'owner' as const,
  invitationState: 'active' as const,
}
const editor = {
  userId: 'editor-1',
  role: 'editor' as const,
  invitationState: 'active' as const,
}

const selection = {
  _id: 'selection-1',
  recipeId: 'recipe-1',
  versionId: 'version-2',
  versionNumber: 2,
  desiredPeople: 6,
  scaleFactor: '1.5' as const,
  createdAt: '2026-09-10T11:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T11:00:00.000Z' as `${string}`,
}

function routeContext(listId = 'list-1') {
  return { params: Promise.resolve({ listId }) }
}

function request(body: unknown) {
  return new Request('http://localhost/api/v1/lists/list-1/complete', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function metadata(operationId = 'complete-1', baseRevision?: number) {
  return {
    operationId,
    clientId: 'client-1',
    localDate: '2026-09-10',
    ...(baseRevision === undefined ? {} : { baseRevision }),
  }
}

function databaseFor({
  listMembers = [owner],
  listStatus = 'active' as const,
  currentRun = {},
  completionMutationReceipts,
}: {
  listMembers?: Array<{
    userId: string
    role: 'owner' | 'editor' | 'viewer'
    invitationState: 'active'
  }>
  listStatus?: 'active' | 'archived'
  currentRun?: Record<string, unknown> | null
  completionMutationReceipts?: unknown[]
} = {}) {
  const list = {
    _id: 'list-1',
    name: 'Family',
    ownerIds: ['user-1'],
    status: listStatus,
    activeRunId: 'run-1',
    members: listMembers,
    ...(completionMutationReceipts ? { completionMutationReceipts } : {}),
  }
  const run = {
    _id: 'run-1',
    listId: 'list-1',
    state: 'active' as const,
    revision: 4,
    recipeSelections: [selection],
    groceryItems: [{ id: 'grocery-1' }],
    manualAdditions: [{ id: 'manual-1' }],
    groceryAmountOverrides: [{ itemId: 'grocery-1' }],
    ordering: ['grocery-1'],
    alreadyHaveItems: [{ itemId: 'grocery-1' }],
    purchasedItems: [{ itemId: 'grocery-1' }],
    groceryCategoryOverrides: [{ itemId: 'grocery-1' }],
    ...currentRun,
  }
  const lists = {
    findOne: vi.fn().mockImplementation(
      (filter: {
        members?: {
          $elemMatch?: {
            userId?: string
            role?: string | { $in: string[] }
          }
        }
      }) => {
        const requestedMember = filter.members?.$elemMatch
        const member = list.members.find(
          (candidate) =>
            candidate.userId === requestedMember?.userId &&
            (requestedMember?.role === undefined ||
              (typeof requestedMember.role === 'string'
                ? candidate.role === requestedMember.role
                : requestedMember.role.$in.includes(candidate.role))),
        )
        return Promise.resolve(member ? list : null)
      },
    ),
    findOneAndUpdate: vi.fn().mockResolvedValue(list),
  }
  const runs = {
    findOne: vi.fn().mockResolvedValue(currentRun === null ? null : run),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  const histories = {
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  const collections: Record<string, unknown> = {
    lists,
    shopping_runs: runs,
    shopping_run_history: histories,
  }
  return {
    db: { collection: vi.fn((name: string) => collections[name]) },
    list,
    lists,
    runs,
    histories,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
  getMongoClient.mockReturnValue({
    withSession: (callback: (session: unknown) => unknown) =>
      callback({
        withTransaction: (transaction: (session: unknown) => unknown) =>
          transaction({}),
      }),
  })
})

describe('POST /api/v1/lists/[listId]/complete', () => {
  it('atomically retains minimal recipe history and creates a fresh empty run', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(request(metadata()), routeContext())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      completed: true,
      localDate: '2026-09-10',
      completedByUserId: 'user-1',
    })
    expect(database.runs.deleteOne).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active' },
      { session: expect.anything() },
    )
    expect(database.histories.insertOne).toHaveBeenCalledWith(
      {
        _id: expect.any(String),
        listId: 'list-1',
        completedAt: expect.any(String),
        localDate: '2026-09-10',
        completedByUserId: 'user-1',
        recipeSelections: [
          {
            _id: 'selection-1',
            recipeId: 'recipe-1',
            versionId: 'version-2',
            versionNumber: 2,
            desiredPeople: 6,
          },
        ],
      },
      { session: expect.anything() },
    )
    expect(database.runs.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: 'list-1',
        state: 'active',
        revision: 0,
        recipeSelections: [],
        groceryItems: [],
        manualAdditions: [],
        ordering: [],
      }),
      { session: expect.anything() },
    )
    expect(database.lists.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'list-1',
        status: 'active',
        activeRunId: 'run-1',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          activeRunId: body.activeRunId,
        }),
        $push: {
          completionMutationReceipts: {
            $each: [expect.anything()],
            $slice: -20,
          },
        },
      }),
      { session: expect.anything(), returnDocument: 'after' },
    )
  })

  it('allows an editor but rejects a viewer or non-member through the role boundary', async () => {
    const database = databaseFor({ listMembers: [owner, editor] })
    getConnectedDatabase.mockResolvedValue(database.db)
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })

    const editorResponse = await POST(
      request(metadata('editor-complete')),
      routeContext(),
    )
    expect(editorResponse.status).toBe(200)

    const viewerDatabase = databaseFor({ listMembers: [owner] })
    getConnectedDatabase.mockResolvedValue(viewerDatabase.db)
    getSession.mockResolvedValue({ user: { id: 'viewer-1' } })
    const viewerResponse = await POST(
      request(metadata('viewer-complete')),
      routeContext(),
    )
    expect(viewerResponse.status).toBe(404)
    expect(viewerDatabase.runs.deleteOne).not.toHaveBeenCalled()
  })

  it('rejects archived lists, stale revisions, and missing active runs', async () => {
    const archived = databaseFor({ listStatus: 'archived' })
    getConnectedDatabase.mockResolvedValue(archived.db)
    expect(
      (await POST(request(metadata('archived')), routeContext())).status,
    ).toBe(409)

    const stale = databaseFor()
    getConnectedDatabase.mockResolvedValue(stale.db)
    expect(
      (await POST(request(metadata('stale', 3)), routeContext())).status,
    ).toBe(409)
    expect(stale.runs.deleteOne).not.toHaveBeenCalled()

    const missing = databaseFor({ currentRun: null })
    getConnectedDatabase.mockResolvedValue(missing.db)
    expect(
      (await POST(request(metadata('missing')), routeContext())).status,
    ).toBe(409)
  })

  it('replays a completion receipt without creating another run', async () => {
    const priorResponse = {
      completed: true,
      historyId: 'history-1',
      activeRunId: 'run-2',
    }
    const database = databaseFor({
      completionMutationReceipts: [
        {
          operationId: 'repeat',
          clientId: 'client-1',
          status: 200,
          response: priorResponse,
        },
      ],
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(request(metadata('repeat')), routeContext())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(priorResponse)
    expect(database.runs.deleteOne).not.toHaveBeenCalled()
    expect(database.histories.insertOne).not.toHaveBeenCalled()
  })
})
