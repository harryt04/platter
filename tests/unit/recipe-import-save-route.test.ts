import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/imports/[importId]/save/route'
import { resetServerEnvForTests } from '@/lib/env/server'

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

const importId = 'b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7'
const source = {
  _id: importId,
  userId: 'user-1',
  idempotencyKey: 'import-key',
  sourceUrl: 'https://example.com/recipe',
  canonicalUrl: 'https://example.com/recipes/imported-soup',
  sourceDomain: 'example.com',
  sourceTitle: 'Imported soup from source',
  sourceAuthor: 'Source Avery',
  importer: 'schema-org-json-ld' as const,
  acquiredAt: '2026-09-10T12:01:00.000Z' as `${string}`,
  acquisitionMethod: 'server-fetch' as const,
  contentFingerprint: `sha256:${'a'.repeat(64)}`,
  rightsStatus: 'unknown' as const,
  status: 'preview-ready' as const,
  attemptCount: 1,
  submittedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  preview: {
    title: 'Imported soup',
    typicalPeopleFed: 4,
    ingredients: [
      {
        originalText: '1 cup carrots',
        quantity: '1',
        unit: 'cup',
        ingredientName: 'carrots',
        normalizedIdentity: 'carrots',
        parserConfidence: 'high' as const,
        optional: false,
      },
    ],
    instructions: ['Simmer.'],
    sourceName: 'Example Recipes',
    sourceUrl: 'https://example.com/recipe',
    warnings: [],
  },
}

function setup(
  importDocument: typeof source & { savedRecipeId?: string } = source,
  existingRecipe: Record<string, unknown> | null = null,
  activeSuppression: Record<string, unknown> | null = null,
) {
  const imports = {
    findOne: vi.fn().mockResolvedValue(importDocument),
    findOneAndUpdate: vi.fn().mockResolvedValue(importDocument),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  const recipes = {
    findOne: vi.fn().mockResolvedValue(existingRecipe),
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  const versions = {
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  const suppressions = {
    findOne: vi.fn().mockResolvedValue(activeSuppression),
  }
  const collection = vi.fn((name: string) =>
    name === 'recipe_imports'
      ? imports
      : name === 'recipes'
        ? recipes
        : name === 'recipe_versions'
          ? versions
          : suppressions,
  )
  getConnectedDatabase.mockResolvedValue({
    collection,
  })
  getMongoClient.mockReturnValue({
    withSession: async (callback: (session: unknown) => unknown) =>
      callback({
        withTransaction: async (transaction: (session: unknown) => unknown) =>
          transaction({}),
      }),
  })
  return { collection, imports, recipes, versions, suppressions }
}

function request(body: unknown) {
  return new Request(`http://localhost/api/v1/imports/${importId}/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  resetServerEnvForTests()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('POST /api/v1/imports/[importId]/save', () => {
  it('publishes a reviewed usable import without adding it to a run', async () => {
    const { collection, imports, recipes, versions } = setup()
    const response = await POST(
      request({
        title: 'Corrected soup',
        typicalPeopleFed: 6,
        sourceName: 'Correct source',
        sourceUrl: source.sourceUrl,
        sourceAuthor: 'Avery',
        attribution: 'Shared with permission.',
        ingredients: [
          {
            ...source.preview.ingredients[0],
            originalText: '2 cups carrots',
            quantity: '2',
          },
        ],
        instructions: ['Stir.', 'Simmer.'],
      }),
      { params: Promise.resolve({ importId }) },
    )

    expect(response.status).toBe(201)
    expect((await response.json()).recipe).toMatchObject({
      title: 'Corrected soup',
      typicalPeopleFed: 6,
      origin: 'imported',
      importReviewStatus: 'approved',
      visibility: 'public',
      sourceName: 'Correct source',
      importProvenance: {
        submittedUrl: source.sourceUrl,
        canonicalUrl: source.canonicalUrl,
        sourceDomain: source.sourceDomain,
        sourceTitle: source.sourceTitle,
        sourceAuthor: source.sourceAuthor,
        importer: source.importer,
        acquiredAt: source.acquiredAt,
        acquisitionMethod: source.acquisitionMethod,
        contentFingerprint: source.contentFingerprint,
        versionRelationship: 'source-original',
        rightsStatus: source.rightsStatus,
      },
      ingredients: [expect.objectContaining({ quantity: '2' })],
      instructions: ['Stir.', 'Simmer.'],
    })
    expect(imports.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: importId,
        userId: 'user-1',
        status: 'preview-ready',
        savedRecipeId: { $exists: false },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ savedRecipeId: expect.any(String) }),
      }),
      { returnDocument: 'after', session: expect.anything() },
    )
    expect(recipes.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Corrected soup',
        origin: 'imported',
        importReviewStatus: 'approved',
        visibility: 'public',
        importProvenance: expect.objectContaining({
          canonicalUrl: source.canonicalUrl,
          contentFingerprint: source.contentFingerprint,
          versionRelationship: 'source-original',
        }),
      }),
      expect.objectContaining({ session: expect.anything() }),
    )
    expect(versions.insertOne).toHaveBeenCalledOnce()
    expect(collection).not.toHaveBeenCalledWith('shopping_runs')
    expect(collection).not.toHaveBeenCalledWith('recipe_saves')
  })

  it('keeps an incomplete reviewed import private until it is usable', async () => {
    const { recipes } = setup()
    const response = await POST(
      request({
        title: 'Soup still needs details',
        ingredients: [],
        instructions: [],
      }),
      { params: Promise.resolve({ importId }) },
    )

    expect(response.status).toBe(201)
    expect((await response.json()).recipe).toMatchObject({
      origin: 'imported',
      importReviewStatus: 'pending',
      visibility: 'private',
      status: 'draft',
    })
    expect(recipes.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        importReviewStatus: 'pending',
        visibility: 'private',
      }),
      expect.objectContaining({ session: expect.anything() }),
    )
  })

  it('does not publish a usable preview when its source is suppressed', async () => {
    const { recipes, versions } = setup(source, null, {
      _id: 'suppression-1',
      targetType: 'fingerprint',
      target: source.contentFingerprint,
      status: 'active',
    })
    const response = await POST(
      request({
        title: 'Suppressed soup',
        typicalPeopleFed: 4,
        ingredients: source.preview.ingredients,
        instructions: source.preview.instructions,
      }),
      { params: Promise.resolve({ importId }) },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'PUBLIC_CONTENT_SUPPRESSED',
    })
    expect(recipes.insertOne).not.toHaveBeenCalled()
    expect(versions.insertOne).not.toHaveBeenCalled()
  })

  it('replays an already-saved import without creating another recipe', async () => {
    const savedRecipeId = 'c7f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b8'
    const { recipes, versions } = setup({ ...source, savedRecipeId })
    const response = await POST(
      request({ title: 'Ignored', ingredients: [], instructions: [] }),
      { params: Promise.resolve({ importId }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ recipeId: savedRecipeId })
    expect(recipes.insertOne).not.toHaveBeenCalled()
    expect(versions.insertOne).not.toHaveBeenCalled()
  })

  it('keeps an existing saved import readable while new public imports are disabled', async () => {
    vi.stubEnv('RECIPE_IMPORTS_ENABLED', 'false')
    resetServerEnvForTests()
    const savedRecipeId = 'c7f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b8'
    const { recipes, versions } = setup({ ...source, savedRecipeId })

    const response = await POST(
      request({ title: 'Ignored', ingredients: [], instructions: [] }),
      { params: Promise.resolve({ importId }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ recipeId: savedRecipeId })
    expect(recipes.insertOne).not.toHaveBeenCalled()
    expect(versions.insertOne).not.toHaveBeenCalled()
  })

  it('lets only one concurrent save claim an import and replays the winner', async () => {
    const { imports, recipes, versions } = setup()
    imports.findOneAndUpdate
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(null)
    imports.findOne.mockResolvedValueOnce(source).mockResolvedValueOnce(source)
    imports.findOne.mockResolvedValueOnce({
      ...source,
      savedRecipeId: 'winner-recipe-id',
    })

    const responses = await Promise.all([
      POST(
        request({
          title: 'Corrected soup',
          typicalPeopleFed: 4,
          ingredients: source.preview.ingredients,
          instructions: source.preview.instructions,
        }),
        { params: Promise.resolve({ importId }) },
      ),
      POST(
        request({
          title: 'Corrected soup',
          typicalPeopleFed: 4,
          ingredients: source.preview.ingredients,
          instructions: source.preview.instructions,
        }),
        { params: Promise.resolve({ importId }) },
      ),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 201,
    ])
    expect(recipes.insertOne).toHaveBeenCalledOnce()
    expect(versions.insertOne).toHaveBeenCalledOnce()
  })

  it('turns a concurrent public-identity race into the existing-recipe response', async () => {
    const { recipes, versions } = setup()
    const existingRecipe = {
      _id: 'raced-public-recipe',
      title: 'Raced soup',
      sourceUrl: source.canonicalUrl,
      importProvenance: {
        canonicalUrl: source.canonicalUrl,
        contentFingerprint: source.contentFingerprint,
      },
    }
    recipes.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingRecipe)
    recipes.insertOne
      .mockResolvedValueOnce({ acknowledged: true })
      .mockRejectedValueOnce({ code: 11000 })

    const body = {
      title: 'Raced soup',
      typicalPeopleFed: 4,
      ingredients: source.preview.ingredients,
      instructions: source.preview.instructions,
    }
    const responses = await Promise.all([
      POST(request(body), { params: Promise.resolve({ importId }) }),
      POST(request(body), { params: Promise.resolve({ importId }) }),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ])
    expect(
      (await responses.find((response) => response.status === 409)?.json()) ??
        {},
    ).toMatchObject({
      code: 'IMPORT_DUPLICATE',
      existingRecipe: { id: existingRecipe._id },
    })
    expect(versions.insertOne).toHaveBeenCalledOnce()
  })

  it('proposes an existing approved public import instead of creating a duplicate', async () => {
    const existingRecipe = {
      _id: 'existing-public-recipe',
      title: 'Existing soup',
      sourceUrl: source.canonicalUrl,
    }
    const { recipes, versions } = setup(source, existingRecipe)

    const response = await POST(
      request({
        title: 'Another copy of soup',
        typicalPeopleFed: 4,
        ingredients: source.preview.ingredients,
        instructions: source.preview.instructions,
      }),
      { params: Promise.resolve({ importId }) },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'IMPORT_DUPLICATE',
      existingRecipe: {
        id: existingRecipe._id,
        title: existingRecipe.title,
        sourceUrl: existingRecipe.sourceUrl,
      },
    })
    expect(recipes.insertOne).not.toHaveBeenCalled()
    expect(versions.insertOne).not.toHaveBeenCalled()
  })

  it('requires confirmation before saving a changed source as a related version', async () => {
    const existingRecipe = {
      _id: 'existing-public-recipe',
      recipeId: 'existing-public-recipe',
      versionId: 'existing-public-version-2',
      versionNumber: 2,
      title: 'Existing soup',
      sourceUrl: source.canonicalUrl,
      importProvenance: {
        canonicalUrl: source.canonicalUrl,
        contentFingerprint: `sha256:${'b'.repeat(64)}`,
      },
    }
    const { recipes, versions } = setup(source, existingRecipe)
    const body = {
      title: 'Updated soup',
      typicalPeopleFed: 4,
      ingredients: source.preview.ingredients,
      instructions: source.preview.instructions,
    }

    const proposal = await POST(request(body), {
      params: Promise.resolve({ importId }),
    })

    expect(proposal.status).toBe(409)
    expect(await proposal.json()).toMatchObject({
      code: 'IMPORT_RELATED_VERSION',
      relatedRecipe: {
        id: existingRecipe._id,
        title: existingRecipe.title,
        versionNumber: 2,
        relationship: 'source-update',
      },
    })
    expect(recipes.insertOne).not.toHaveBeenCalled()

    const confirmed = await POST(
      request({ ...body, acceptRelatedVersion: true }),
      { params: Promise.resolve({ importId }) },
    )

    expect(confirmed.status).toBe(201)
    expect((await confirmed.json()).recipe.importProvenance).toMatchObject({
      versionRelationship: 'source-update',
      relatedRecipeId: existingRecipe._id,
      relatedVersionId: existingRecipe.versionId,
      relatedVersionNumber: existingRecipe.versionNumber,
    })
    expect(versions.insertOne).toHaveBeenCalledOnce()
  })
})
