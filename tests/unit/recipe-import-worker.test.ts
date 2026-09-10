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

  it('atomically claims a queued import and stores an editable preview', async () => {
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      updateOne: vi.fn(),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi.fn().mockResolvedValue({
      requestedUrl: document.sourceUrl,
      finalUrl: document.sourceUrl,
      contentType: 'text/html',
      body: `<link rel="canonical" href="/recipes/worker-soup">
        <script type="application/ld+json">${JSON.stringify({
          '@type': 'Recipe',
          name: 'Worker soup',
          recipeYield: '4',
          recipeIngredient: ['1 cup carrots'],
          recipeInstructions: ['Simmer.'],
        })}</script>`,
      byteLength: 180,
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
    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: document._id, userId: document.userId, status: 'processing' },
      {
        $set: {
          status: 'preview-ready',
          preview: expect.objectContaining({
            title: 'Worker soup',
            typicalPeopleFed: 4,
            sourceUrl: document.sourceUrl,
          }),
          canonicalUrl: 'https://example.com/recipes/worker-soup',
          sourceDomain: 'example.com',
          sourceTitle: 'Worker soup',
          importer: 'schema-org-json-ld',
          acquiredAt: expect.any(String),
          acquisitionMethod: 'server-fetch',
          contentFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
          rightsStatus: 'unknown',
          updatedAt: expect.any(String),
        },
        $unset: { failureCode: '' },
      },
    )
  })

  it('uses generic extraction when no structured recipe candidate is found', async () => {
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi.fn().mockResolvedValue({
      requestedUrl: document.sourceUrl,
      finalUrl: document.sourceUrl,
      contentType: 'text/html',
      body: '<html><title>Not structured</title></html>',
      byteLength: 45,
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

    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: document._id, userId: document.userId, status: 'processing' },
      {
        $set: {
          status: 'preview-ready',
          preview: expect.objectContaining({
            title: 'Not structured',
            warnings: expect.arrayContaining([
              'Generic extraction was used. Review every imported field before saving.',
            ]),
          }),
          canonicalUrl: document.sourceUrl,
          sourceDomain: 'example.com',
          sourceTitle: 'Not structured',
          importer: 'generic-html',
          acquiredAt: expect.any(String),
          acquisitionMethod: 'server-fetch',
          contentFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
          rightsStatus: 'unknown',
          updatedAt: expect.any(String),
        },
        $unset: { failureCode: '' },
      },
    )
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

  it('marks transient failures for retry and rethrows them for Agenda', async () => {
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi
      .fn()
      .mockRejectedValue(new RecipeImportFetchError('TIMEOUT'))

    await expect(
      createRecipeImportJobHandler(
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
      }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' })

    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: document._id, userId: document.userId, status: 'processing' },
      {
        $set: { status: 'retrying', updatedAt: expect.any(String) },
        $unset: { failureCode: '' },
      },
    )
  })

  it('fails a transient import after the bounded retry budget is exhausted', async () => {
    const exhaustedDocument = { ...document, attemptCount: 4 }
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(exhaustedDocument),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi
      .fn()
      .mockRejectedValue(new RecipeImportFetchError('UPSTREAM_FAILURE'))

    await expect(
      createRecipeImportJobHandler(
        db as never,
        fetcher,
      )({
        attrs: {
          data: {
            importId: exhaustedDocument._id,
            userId: exhaustedDocument.userId,
            idempotencyKey: exhaustedDocument.idempotencyKey,
          },
        },
      }),
    ).resolves.toBeUndefined()

    expect(collection.updateOne).toHaveBeenCalledWith(
      {
        _id: exhaustedDocument._id,
        userId: exhaustedDocument.userId,
        status: 'processing',
      },
      {
        $set: {
          status: 'failed',
          failureCode: 'UPSTREAM_FAILURE',
          updatedAt: expect.any(String),
        },
      },
    )
  })
})
