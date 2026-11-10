import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/admin/public-content-suppressions/[suppressionId]/restore/route'
import { isoDateTime } from '@/lib/contracts/ids'
import type {
  PublicContentSuppressionAuditDocument,
  PublicContentSuppressionDocument,
} from '@/lib/public-content-suppressions'

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

const suppressionId = '00000000-0000-4000-8000-000000000001'
const activeSuppression: PublicContentSuppressionDocument = {
  _id: suppressionId,
  targetType: 'recipe',
  target: 'recipe-1',
  reason: 'Rights holder requested removal.',
  status: 'active',
  createdBy: 'admin-1',
  createdAt: isoDateTime('2026-09-10T12:00:00.000Z'),
  auditId: '00000000-0000-4000-8000-000000000002',
}

function setup({
  otherActive = [] as PublicContentSuppressionDocument[],
} = {}) {
  const insertedAudits: PublicContentSuppressionAuditDocument[] = []
  const updateSuppression = vi.fn().mockResolvedValue({ matchedCount: 1 })
  const updateRecipes = vi.fn().mockResolvedValue({ matchedCount: 1 })
  const findOne = vi
    .fn()
    .mockResolvedValueOnce(activeSuppression)
    .mockResolvedValueOnce(activeSuppression)
  const suppressionCursor = {
    toArray: vi.fn().mockResolvedValue(otherActive),
  }
  const suppressionCollection = {
    findOne,
    find: vi.fn().mockReturnValue(suppressionCursor),
    updateOne: updateSuppression,
  }
  const auditCollection = {
    insertOne: vi.fn((audit: PublicContentSuppressionAuditDocument) => {
      insertedAudits.push(audit)
      return Promise.resolve()
    }),
  }
  const recipeCollection = { updateMany: updateRecipes }
  const collections = new Map<string, unknown>([
    ['public_content_suppressions', suppressionCollection],
    ['public_content_suppression_audit', auditCollection],
    ['recipes', recipeCollection],
  ])
  const db = {
    collection: vi.fn((name: string) => collections.get(name)),
  }
  getConnectedDatabase.mockResolvedValue(db)
  getMongoClient.mockReturnValue({
    withSession: vi.fn(async (callback: (session: unknown) => unknown) =>
      callback({
        withTransaction: (transaction: (session: unknown) => unknown) =>
          transaction({}),
      }),
    ),
  })
  return {
    auditCollection,
    insertedAudits,
    recipeCollection,
    updateSuppression,
  }
}

function request() {
  return new Request(
    `http://localhost/api/v1/admin/public-content-suppressions/${suppressionId}/restore`,
    { method: 'POST' },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'admin-2', role: 'admin' } })
})

describe('POST /api/v1/admin/public-content-suppressions/:id/restore', () => {
  it('restores matching suppressed recipes and records an administrator audit', async () => {
    const setupResult = setup()
    const response = await POST(request(), {
      params: Promise.resolve({ suppressionId }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      suppression: {
        id: suppressionId,
        status: 'restored',
        restoredBy: 'admin-2',
        restorationAuditId: expect.any(String),
      },
    })
    expect(setupResult.updateSuppression).toHaveBeenCalledWith(
      { _id: suppressionId, status: 'active' },
      {
        $set: expect.objectContaining({
          status: 'restored',
          restoredBy: 'admin-2',
          restoredAt: expect.any(String),
          restorationAuditId: expect.any(String),
        }),
      },
      expect.objectContaining({ session: expect.anything() }),
    )
    expect(setupResult.insertedAudits).toHaveLength(1)
    expect(setupResult.insertedAudits[0]).toMatchObject({
      suppressionId,
      action: 'restored',
      target: 'recipe-1',
      actorId: 'admin-2',
    })
    expect(setupResult.recipeCollection.updateMany).toHaveBeenCalledWith(
      {
        $and: [
          { status: 'usable', visibility: 'suppressed' },
          { _id: 'recipe-1' },
        ],
      },
      {
        $set: {
          visibility: 'public',
          updatedAt: expect.any(String),
        },
      },
      expect.objectContaining({ session: expect.anything() }),
    )
  })

  it('keeps content suppressed when another active target still matches it', async () => {
    const setupResult = setup({
      otherActive: [
        {
          ...activeSuppression,
          _id: '00000000-0000-4000-8000-000000000003',
          targetType: 'domain',
          target: 'example.com',
        },
      ],
    })

    await POST(request(), { params: Promise.resolve({ suppressionId }) })

    expect(setupResult.recipeCollection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $nor: [
              expect.objectContaining({
                $or: expect.any(Array),
              }),
            ],
          }),
        ]),
      }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('enforces administrator access, opaque IDs, and one-time restoration', async () => {
    getSession.mockResolvedValueOnce(null)
    expect(
      (await POST(request(), { params: Promise.resolve({ suppressionId }) }))
        .status,
    ).toBe(401)

    getSession.mockResolvedValueOnce({ user: { id: 'user-1', role: 'user' } })
    expect(
      (await POST(request(), { params: Promise.resolve({ suppressionId }) }))
        .status,
    ).toBe(403)

    getSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'admin' } })
    expect(
      (
        await POST(request(), {
          params: Promise.resolve({ suppressionId: 'not-an-id' }),
        })
      ).status,
    ).toBe(404)

    getSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    const restored: PublicContentSuppressionDocument = {
      ...activeSuppression,
      status: 'restored',
      restoredBy: 'admin-1',
      restoredAt: isoDateTime('2026-09-10T13:00:00.000Z'),
      restorationAuditId: '00000000-0000-4000-8000-000000000004',
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue(restored),
      }),
    })
    expect(
      (await POST(request(), { params: Promise.resolve({ suppressionId }) }))
        .status,
    ).toBe(409)
  })

  it('hides storage and malformed-record failures behind a retryable problem', async () => {
    getConnectedDatabase.mockRejectedValueOnce(
      new Error('database credentials leaked'),
    )
    const unavailableResponse = await POST(request(), {
      params: Promise.resolve({ suppressionId }),
    })

    expect(unavailableResponse.status).toBe(503)
    expect(JSON.stringify(await unavailableResponse.json())).not.toContain(
      'database credentials leaked',
    )

    getConnectedDatabase.mockResolvedValueOnce({
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue({
          ...activeSuppression,
          createdAt: 'not-a-timestamp',
        }),
      }),
    })
    const malformedResponse = await POST(request(), {
      params: Promise.resolve({ suppressionId }),
    })

    expect(malformedResponse.status).toBe(503)
    expect(JSON.stringify(await malformedResponse.json())).not.toContain(
      'not-a-timestamp',
    )
  })
})
