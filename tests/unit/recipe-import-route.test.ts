import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/v1/imports/route'
import { GET as getStatus } from '@/app/api/v1/imports/[importId]/route'
import { resetServerEnvForTests } from '@/lib/env/server'
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
  idempotencyKey: 'import-key-1',
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
    findOne: vi
      .fn()
      .mockImplementation(async (filter: Record<string, string>) =>
        filter.idempotencyKey
          ? filter.idempotencyKey === document.idempotencyKey
            ? document
            : null
          : document,
      ),
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
  vi.unstubAllEnvs()
  resetServerEnvForTests()
  resetRateLimitsForTests()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
  enqueueRecipeImport.mockResolvedValue(undefined)
})

describe('/api/v1/imports', () => {
  it('rejects new submissions while leaving persistence untouched when imports are disabled', async () => {
    vi.stubEnv('RECIPE_IMPORTS_ENABLED', 'false')
    resetServerEnvForTests()
    const collection = setup()

    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        headers: { 'idempotency-key': 'disabled-import-key' },
        body: JSON.stringify({ sourceUrl: importDocument.sourceUrl }),
      }),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('PUBLIC_IMPORTS_DISABLED')
    expect(collection.insertOne).not.toHaveBeenCalled()
    expect(enqueueRecipeImport).not.toHaveBeenCalled()
  })

  it('keeps hosted imports disabled until the published policy configuration is complete', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RECIPE_IMPORTS_ENABLED', 'true')
    vi.stubEnv('PUBLIC_CATALOG_POLICIES_PUBLISHED', 'false')
    resetServerEnvForTests()
    const collection = setup()

    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        headers: { 'idempotency-key': 'policy-gated-import-key' },
        body: JSON.stringify({ sourceUrl: importDocument.sourceUrl }),
      }),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('PUBLIC_IMPORTS_DISABLED')
    expect(collection.insertOne).not.toHaveBeenCalled()
  })

  it('requires authentication for submission and status listing', async () => {
    getSession.mockResolvedValue(null)

    expect((await GET()).status).toBe(401)
    expect(
      (
        await POST(
          new Request('http://localhost/api/v1/imports', {
            method: 'POST',
            headers: { 'idempotency-key': 'auth-test-key' },
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
        headers: { 'idempotency-key': 'new-import-key' },
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
      expect.objectContaining({
        importId: expect.any(String),
        userId: 'user-1',
        idempotencyKey: 'new-import-key',
        jobGeneration: expect.any(String),
      }),
    )
  })

  it('replays a retry with the same key without creating or enqueueing another import', async () => {
    const existing = { ...importDocument, idempotencyKey: 'retry-key' }
    const collection = setup(existing)
    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        headers: { 'idempotency-key': 'retry-key' },
        body: JSON.stringify({ sourceUrl: existing.sourceUrl }),
      }),
    )

    expect(response.status).toBe(202)
    expect((await response.json()).import.id).toBe(existing._id)
    expect(collection.insertOne).not.toHaveBeenCalled()
    expect(enqueueRecipeImport).not.toHaveBeenCalled()
  })

  it('rejects reusing an idempotency key for a different URL', async () => {
    const existing = { ...importDocument, idempotencyKey: 'reused-key' }
    const collection = setup(existing)
    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        headers: { 'idempotency-key': 'reused-key' },
        body: JSON.stringify({ sourceUrl: 'https://example.com/other-recipe' }),
      }),
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('IDEMPOTENCY_KEY_REUSED')
    expect(collection.insertOne).not.toHaveBeenCalled()
    expect(enqueueRecipeImport).not.toHaveBeenCalled()
  })

  it('requires an idempotency key before touching persistence', async () => {
    const collection = setup()
    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        body: JSON.stringify({ sourceUrl: importDocument.sourceUrl }),
      }),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('INVALID_IDEMPOTENCY_KEY')
    expect(collection.insertOne).not.toHaveBeenCalled()
    expect(enqueueRecipeImport).not.toHaveBeenCalled()
  })

  it('rejects non-web URLs without touching persistence', async () => {
    const collection = setup()
    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        headers: { 'idempotency-key': 'invalid-url-key' },
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
        headers: { 'idempotency-key': 'credentials-url-key' },
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

  it('hides import-list storage failures behind a retryable problem', async () => {
    getConnectedDatabase.mockRejectedValueOnce(new Error('mongo unavailable'))

    const response = await GET()

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    const body = await response.json()
    expect(body).toMatchObject({
      code: 'IMPORT_STATUS_UNAVAILABLE',
      status: 503,
    })
    expect(JSON.stringify(body)).not.toContain('mongo unavailable')
  })

  it('rate-limits import submissions per authenticated user', async () => {
    const collection = setup()
    const responses = await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        POST(
          new Request('http://localhost/api/v1/imports', {
            method: 'POST',
            headers: { 'idempotency-key': `rate-limit-key-${index}` },
            body: JSON.stringify({ sourceUrl: importDocument.sourceUrl }),
          }),
        ),
      ),
    )

    expect(
      responses.slice(0, 10).every((response) => response.status === 202),
    ).toBe(true)
    expect(responses[10]?.status).toBe(429)
    expect(responses[10]?.headers.get('Retry-After')).toMatch(/^\d+$/)
    expect(collection.insertOne).toHaveBeenCalledTimes(10)
    expect(enqueueRecipeImport).toHaveBeenCalledTimes(10)
  })

  it('rate-limits import status listing per authenticated user', async () => {
    const collection = setup()
    const responses = await Promise.all(
      Array.from({ length: 121 }, () => GET()),
    )

    expect(
      responses.slice(0, 120).every((response) => response.status === 200),
    ).toBe(true)
    expect(responses[120]?.status).toBe(429)
    expect(responses[120]?.headers.get('Retry-After')).toMatch(/^\d+$/)
    expect(collection.find).toHaveBeenCalledTimes(120)
  })

  it('records queue failure without exposing or mutating other product data', async () => {
    const collection = setup()
    enqueueRecipeImport.mockRejectedValueOnce(new Error('worker unavailable'))

    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        headers: { 'idempotency-key': 'queue-failure-key' },
        body: JSON.stringify({ sourceUrl: importDocument.sourceUrl }),
      }),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('IMPORT_QUEUE_UNAVAILABLE')
    expect(collection.updateOne).toHaveBeenCalledWith(
      {
        _id: expect.any(String),
        userId: 'user-1',
      },
      {
        $set: {
          status: 'failed',
          failureCode: 'IMPORT_QUEUE_UNAVAILABLE',
          updatedAt: expect.any(String),
        },
      },
    )
    expect(collection.updateOne).toHaveBeenCalledOnce()
  })

  it('hides submission storage failures behind a retryable problem', async () => {
    getConnectedDatabase.mockRejectedValueOnce(new Error('mongo unavailable'))

    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        headers: { 'idempotency-key': 'storage-failure-key' },
        body: JSON.stringify({ sourceUrl: importDocument.sourceUrl }),
      }),
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'IMPORT_STATUS_UNAVAILABLE',
      status: 503,
    })
  })

  it('hides malformed replayed submission data behind a retryable problem', async () => {
    const collection = setup({
      ...importDocument,
      status: 'unexpected' as never,
    })

    const response = await POST(
      new Request('http://localhost/api/v1/imports', {
        method: 'POST',
        headers: { 'idempotency-key': importDocument.idempotencyKey },
        body: JSON.stringify({ sourceUrl: importDocument.sourceUrl }),
      }),
    )

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body).toMatchObject({
      code: 'IMPORT_STATUS_UNAVAILABLE',
      status: 503,
    })
    expect(JSON.stringify(body)).not.toContain('unexpected')
    expect(collection.findOne).toHaveBeenCalledOnce()
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

  it('hides malformed persisted status data behind a retryable problem', async () => {
    const malformed = setup({
      ...importDocument,
      status: 'unexpected' as never,
    })

    const response = await getStatus(
      new Request(
        'http://localhost/api/v1/imports/b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7',
      ),
      { params: Promise.resolve({ importId: importDocument._id }) },
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'IMPORT_STATUS_UNAVAILABLE',
      status: 503,
    })
    expect(malformed.findOne).toHaveBeenCalledOnce()
  })

  it('rate-limits detail status reads per authenticated user', async () => {
    const collection = setup()
    const responses = await Promise.all(
      Array.from({ length: 121 }, () =>
        getStatus(
          new Request(
            'http://localhost/api/v1/imports/b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7',
          ),
          { params: Promise.resolve({ importId: importDocument._id }) },
        ),
      ),
    )

    expect(
      responses.slice(0, 120).every((response) => response.status === 200),
    ).toBe(true)
    expect(responses[120]?.status).toBe(429)
    expect(responses[120]?.headers.get('Retry-After')).toMatch(/^\d+$/)
    expect(collection.findOne).toHaveBeenCalledTimes(120)
  })
})
