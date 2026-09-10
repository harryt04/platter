import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/imports/[importId]/save/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

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
) {
  const imports = {
    findOne: vi.fn().mockResolvedValue(importDocument),
    findOneAndUpdate: vi.fn().mockResolvedValue(importDocument),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  const recipes = {
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  const versions = {
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  const collection = vi.fn((name: string) =>
    name === 'recipe_imports'
      ? imports
      : name === 'recipes'
        ? recipes
        : versions,
  )
  getConnectedDatabase.mockResolvedValue({
    collection,
  })
  return { collection, imports, recipes, versions }
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
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('POST /api/v1/imports/[importId]/save', () => {
  it('saves corrected preview fields as a private imported draft', async () => {
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
      importReviewStatus: 'pending',
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
      { returnDocument: 'after' },
    )
    expect(recipes.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Corrected soup',
        origin: 'imported',
        importReviewStatus: 'pending',
        importProvenance: expect.objectContaining({
          canonicalUrl: source.canonicalUrl,
          contentFingerprint: source.contentFingerprint,
          versionRelationship: 'source-original',
        }),
      }),
    )
    expect(versions.insertOne).toHaveBeenCalledOnce()
    expect(collection).not.toHaveBeenCalledWith('shopping_runs')
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
})
