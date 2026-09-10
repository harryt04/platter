import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/imports/[importId]/retry/route'
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

const baseImport = {
  _id: 'b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7',
  userId: 'user-1',
  idempotencyKey: 'import-key-1',
  sourceUrl: 'https://example.com/recipe',
  status: 'failed' as const,
  attemptCount: 4,
  submittedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  failureCode: 'TIMEOUT',
}

type TestImport = Omit<typeof baseImport, 'status'> & {
  status: 'failed' | 'preview-ready'
  savedRecipeId?: string
  preview?: { title: string; warnings: string[] }
}

function setup(document: TestImport = baseImport) {
  const queued = {
    ...document,
    status: 'queued' as const,
    attemptCount: 0,
    jobGeneration: 'a7c2b37c-2b06-4540-9c2c-f75d6ebc0e16',
  }
  const collection = {
    findOne: vi.fn().mockResolvedValue(document),
    findOneAndUpdate: vi.fn().mockResolvedValue(queued),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  getConnectedDatabase.mockResolvedValue({
    collection: vi.fn().mockReturnValue(collection),
  })
  return { collection, queued }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimitsForTests()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
  enqueueRecipeImport.mockResolvedValue(undefined)
})

describe('POST /api/v1/imports/[importId]/retry', () => {
  it('atomically resets a failed import and enqueues a typed retry generation', async () => {
    const { collection, queued } = setup()
    const response = await POST(
      new Request('http://localhost/api/v1/imports/import-id/retry', {
        method: 'POST',
        body: JSON.stringify({ action: 'retry' }),
      }),
      { params: Promise.resolve({ importId: baseImport._id }) },
    )

    expect(response.status).toBe(202)
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: baseImport._id,
        status: { $in: ['failed'] },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'queued',
          attemptCount: 0,
          jobGeneration: expect.any(String),
        }),
      }),
      { returnDocument: 'after' },
    )
    expect(enqueueRecipeImport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        importId: queued._id,
        operation: 'retry',
        jobGeneration: expect.any(String),
      }),
    )
  })

  it('reprocesses a preview-ready historical import without creating a new import record', async () => {
    const historical = {
      ...baseImport,
      status: 'preview-ready' as const,
      attemptCount: 1,
      savedRecipeId: 'saved-recipe-1',
      preview: { title: 'Saved soup', warnings: [] },
    }
    const { collection } = setup(historical)
    const response = await POST(
      new Request('http://localhost/api/v1/imports/import-id/retry', {
        method: 'POST',
        body: JSON.stringify({ action: 'reprocess' }),
      }),
      { params: Promise.resolve({ importId: historical._id }) },
    )

    expect(response.status).toBe(202)
    expect('insertOne' in collection).toBe(false)
    expect(enqueueRecipeImport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operation: 'reprocess' }),
    )
    expect((await response.json()).import.savedRecipeId).toBe('saved-recipe-1')
  })

  it('does not allow reprocessing a failed import with the wrong action', async () => {
    const { collection } = setup()
    const response = await POST(
      new Request('http://localhost/api/v1/imports/import-id/retry', {
        method: 'POST',
        body: JSON.stringify({ action: 'reprocess' }),
      }),
      { params: Promise.resolve({ importId: baseImport._id }) },
    )

    expect(response.status).toBe(409)
    expect(collection.findOneAndUpdate).not.toHaveBeenCalled()
    expect(enqueueRecipeImport).not.toHaveBeenCalled()
  })
})
