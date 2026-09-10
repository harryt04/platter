import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRecipeImportJobHandler } from '@/lib/recipe-import-worker'
import { RecipeImportFetchError } from '@/lib/recipe-import-fetcher'

const document = {
  _id: 'b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7',
  userId: 'user-1',
  idempotencyKey: 'worker-key',
  sourceUrl: 'https://example.com/recipe',
  status: 'processing' as const,
  attemptCount: 1,
  submittedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

describe('recipe import worker fetch stage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('atomically claims a queued import and fetches only its persisted URL', async () => {
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      updateOne: vi.fn(),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi.fn().mockResolvedValue({
      requestedUrl: document.sourceUrl,
      finalUrl: document.sourceUrl,
      contentType: 'text/html',
      body: '<html />',
      byteLength: 9,
    })

    await createRecipeImportJobHandler(
      db as never,
      fetcher,
    )({
      attrs: {
        data: {
          importId: document._id,
          userId: document.userId,
          idempotencyKey: document.idempotencyKey,
        },
      },
    })

    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: document._id,
        userId: document.userId,
        idempotencyKey: document.idempotencyKey,
        status: { $in: ['queued', 'retrying'] },
      },
      {
        $set: { status: 'processing', updatedAt: expect.any(String) },
        $inc: { attemptCount: 1 },
      },
      { returnDocument: 'after' },
    )
    expect(fetcher).toHaveBeenCalledWith(document.sourceUrl)
    expect(collection.updateOne).not.toHaveBeenCalled()
  })

  it('records a typed fetch failure without publishing or retrying unsafe content', async () => {
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi
      .fn()
      .mockRejectedValue(new RecipeImportFetchError('REDIRECT_BLOCKED'))

    await createRecipeImportJobHandler(
      db as never,
      fetcher,
    )({
      attrs: {
        data: {
          importId: document._id,
          userId: document.userId,
          idempotencyKey: document.idempotencyKey,
        },
      },
    })

    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: document._id, userId: document.userId, status: 'processing' },
      {
        $set: {
          status: 'failed',
          failureCode: 'REDIRECT_BLOCKED',
          updatedAt: expect.any(String),
        },
      },
    )
  })
})
