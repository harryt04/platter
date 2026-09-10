import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/v1/imports/route'
import { GET as getStatus } from '@/app/api/v1/imports/[importId]/route'
import { resetRateLimitsForTests } from '@/lib/security/rate-limit'

const { getSession, getConnectedDatabase, enqueueRecipeImport } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    getConnectedDatabase: vi.fn(),
    enqueueRecipeImport: vi.fn(),
  }),
)

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/jobs/queue', () => ({ enqueueRecipeImport }))

const importDocument = {
  _id: 'b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7',
  userId: 'user-1',
  sourceUrl: 'https://example.com/recipe',
  status: 'queued' as const,
  attemptCount: 0,
  submittedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

function setup(document = importDocument) {
  const collection = {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([document]),
        }),
      }),
    }),
    findOne: vi.fn().mockResolvedValue(document),
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  getConnectedDatabase.mockResolvedValue({
    collection: vi.fn().mockReturnValue(collection),
  })
  return collection
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimitsForTests()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
  enqueueRecipeImport.mockResolvedValue(undefined)
})

describe('/api/v1/imports', () => {
  it('requires authentication for submission and status listing', async () => {
    getSession.mockResolvedValue(null)

    expect((await GET()).status).toBe(401)
    expect(
      (
        await POST(
          new Request('http://localhost/api/v1/imports', {
            method: 'POST',
            body: JSON.stringify({ sourceUrl: importDocument.sourceUrl }),
          }),
        )
      ).status,
    ).toBe(401)
  })

  it('accepts only HTTP(S) URLs, persists queued state, and enqueues the worker', async () => {
    const collection = setup()
    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        body: JSON.stringify({ sourceUrl: '  https://example.com/recipe  ' }),
      }),
    )

    expect(response.status).toBe(202)
    expect((await response.json()).import).toMatchObject({
      sourceUrl: 'https://example.com/recipe',
      status: 'queued',
      attemptCount: 0,
    })
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sourceUrl: 'https://example.com/recipe',
        status: 'queued',
      }),
    )
    expect(enqueueRecipeImport).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'https://example.com/recipe',
    )
  })

  it('rejects non-web URLs without touching persistence', async () => {
    const collection = setup()
    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        body: JSON.stringify({ sourceUrl: 'file:///tmp/recipe.html' }),
      }),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(collection.insertOne).not.toHaveBeenCalled()
    expect(enqueueRecipeImport).not.toHaveBeenCalled()
  })

  it('rejects URLs containing embedded credentials', async () => {
    const collection = setup()
    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        body: JSON.stringify({
          sourceUrl: 'https://user:secret@example.com/recipe',
        }),
      }),
    )

    expect(response.status).toBe(422)
    expect(collection.insertOne).not.toHaveBeenCalled()
    expect(enqueueRecipeImport).not.toHaveBeenCalled()
  })

  it('lists only the current user’s durable import summaries', async () => {
    const collection = setup()
    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      imports: [
        {
          id: importDocument._id,
          sourceUrl: importDocument.sourceUrl,
          status: 'queued',
          attemptCount: 0,
          submittedAt: importDocument.submittedAt,
          updatedAt: importDocument.updatedAt,
        },
      ],
    })
    expect(collection.find).toHaveBeenCalledWith({ userId: 'user-1' })
  })
})

describe('GET /api/v1/imports/[importId]', () => {
  it('returns an owned import status and hides malformed ids', async () => {
    const collection = setup()
    const response = await getStatus(
      new Request(
        'http://localhost/api/v1/imports/b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7',
      ),
      { params: Promise.resolve({ importId: importDocument._id }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).import).toMatchObject({
      id: importDocument._id,
      status: 'queued',
    })
    expect(collection.findOne).toHaveBeenCalledWith({
      _id: importDocument._id,
      userId: 'user-1',
    })

    const malformed = await getStatus(
      new Request('http://localhost/api/v1/imports/not-an-id'),
      { params: Promise.resolve({ importId: 'not-an-id' }) },
    )
    expect(malformed.status).toBe(404)
    expect(collection.findOne).toHaveBeenCalledTimes(1)
  })
})
