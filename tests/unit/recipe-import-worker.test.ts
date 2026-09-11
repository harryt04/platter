import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetServerEnvForTests } from '@/lib/env/server'
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
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    resetServerEnvForTests()
  })

  it('atomically claims a queued import and stores an editable preview', async () => {
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      findOne: vi.fn().mockResolvedValue(null),
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

  it('fails queued work without fetching when the operator disables imports', async () => {
    vi.stubEnv('RECIPE_IMPORTS_ENABLED', 'false')
    resetServerEnvForTests()
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi.fn()

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

    expect(fetcher).not.toHaveBeenCalled()
    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: document._id, userId: document.userId, status: 'processing' },
      {
        $set: {
          status: 'failed',
          failureCode: 'PUBLIC_IMPORTS_DISABLED',
          updatedAt: expect.any(String),
        },
      },
    )
  })

  it('uses generic extraction when no structured recipe candidate is found', async () => {
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      findOne: vi.fn().mockResolvedValue(null),
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
      findOne: vi.fn().mockResolvedValue(null),
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

  it('fails a fetched import when its source identity is actively suppressed', async () => {
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      findOne: vi.fn().mockResolvedValue({
        _id: 'suppression-1',
        targetType: 'domain',
        target: 'example.com',
        status: 'active',
      }),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi.fn().mockResolvedValue({
      requestedUrl: document.sourceUrl,
      finalUrl: document.sourceUrl,
      contentType: 'text/html',
      body: '<html><title>Suppressed soup</title></html>',
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
          status: 'failed',
          failureCode: 'PUBLIC_CONTENT_SUPPRESSED',
          updatedAt: expect.any(String),
        },
      },
    )
    expect(collection.updateOne).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'preview-ready' }),
      }),
    )
  })

  it('isolates imports when the operator disables every configured adapter', async () => {
    vi.stubEnv(
      'RECIPE_IMPORT_DISABLED_ADAPTERS',
      'schema-org-json-ld,generic-html',
    )
    resetServerEnvForTests()

    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      findOne: vi.fn().mockResolvedValue(null),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi.fn().mockResolvedValue({
      requestedUrl: document.sourceUrl,
      finalUrl: document.sourceUrl,
      contentType: 'text/html',
      body: '<h1>Recipe</h1>',
      byteLength: 20,
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
          status: 'failed',
          failureCode: 'ADAPTER_DISABLED',
          updatedAt: expect.any(String),
        },
      },
    )
    expect(db.collection).toHaveBeenCalledOnce()
  })

  it('marks transient failures for retry and rethrows them for Agenda', async () => {
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(document),
      findOne: vi.fn().mockResolvedValue(null),
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
      findOne: vi.fn().mockResolvedValue(null),
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

  it('marks a saved recipe source unavailable without replacing normalized content', async () => {
    const savedDocument = {
      ...document,
      savedRecipeId: 'saved-recipe-1',
    }
    const imports = {
      findOneAndUpdate: vi.fn().mockResolvedValue(savedDocument),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    }
    const recipes = {
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    }
    const db = {
      collection: vi.fn((name: string) =>
        name === 'recipe_imports' ? imports : recipes,
      ),
    }
    const fetcher = vi
      .fn()
      .mockRejectedValue(new RecipeImportFetchError('SOURCE_UNAVAILABLE'))

    await createRecipeImportJobHandler(
      db as never,
      fetcher,
    )({
      attrs: {
        data: {
          importId: savedDocument._id,
          userId: savedDocument.userId,
          idempotencyKey: savedDocument.idempotencyKey,
        },
      },
    })

    expect(imports.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing' }),
      {
        $set: expect.objectContaining({
          status: 'failed',
          failureCode: 'SOURCE_UNAVAILABLE',
          sourceAvailability: 'unavailable',
          sourceCheckedAt: expect.any(String),
        }),
      },
    )
    expect(recipes.updateOne).toHaveBeenCalledWith(
      {
        _id: savedDocument.savedRecipeId,
        origin: 'imported',
        importProvenance: { $exists: true },
      },
      {
        $set: {
          'importProvenance.sourceAvailability': 'unavailable',
          'importProvenance.sourceCheckedAt': expect.any(String),
          updatedAt: expect.any(String),
        },
      },
    )
  })

  it('reprocesses a historical import generation without changing its saved recipe claim', async () => {
    const historicalDocument = {
      ...document,
      status: 'queued' as const,
      attemptCount: 0,
      jobGeneration: 'a7c2b37c-2b06-4540-9c2c-f75d6ebc0e16',
      savedRecipeId: 'saved-recipe-1',
    }
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(historicalDocument),
      findOne: vi.fn().mockResolvedValue(null),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    const db = { collection: vi.fn().mockReturnValue(collection) }
    const fetcher = vi.fn().mockResolvedValue({
      requestedUrl: document.sourceUrl,
      finalUrl: document.sourceUrl,
      contentType: 'text/html',
      body: `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'Refreshed soup',
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
          importId: historicalDocument._id,
          userId: historicalDocument.userId,
          idempotencyKey: historicalDocument.idempotencyKey,
          operation: 'reprocess',
          jobGeneration: historicalDocument.jobGeneration,
        },
      },
    })

    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: historicalDocument._id,
        jobGeneration: historicalDocument.jobGeneration,
      }),
      expect.anything(),
      expect.anything(),
    )
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        jobGeneration: historicalDocument.jobGeneration,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'preview-ready' }),
      }),
    )
  })
})
