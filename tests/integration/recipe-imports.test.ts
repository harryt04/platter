import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { Db } from 'mongodb'
import { GET as getRecipe } from '@/app/api/v1/recipes/[recipeId]/route'
import { POST as saveImport } from '@/app/api/v1/imports/[importId]/save/route'
import { isoDateTime } from '@/lib/contracts/ids'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import type { RecipeImportDocument } from '@/lib/recipe-imports'
import type {
  RecipeDraftDocument,
  RecipeVersionDocument,
} from '@/lib/recipes/drafts'
import { findRecipeLibrary } from '@/lib/recipes/library'
import { MongoRecipeSearchProvider } from '@/lib/search/mongo-provider'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))

const databaseName = process.env.MONGODB_DATABASE ?? ''
const fixtureToken = `platterimportintegration${Date.now()}`
const ownerId = `${fixtureToken}-owner`
const outsiderId = `${fixtureToken}-outsider`
const sourceUrl = `https://source-${fixtureToken}.test/recipes/soup`
const canonicalUrl = `https://source-${fixtureToken}.test/recipes/soup`
const versionedSourceUrl = `https://source-${fixtureToken}.test/recipes/versioned-soup`
const versionedCanonicalUrl = `https://source-${fixtureToken}.test/recipes/versioned-soup`
const timestamp = isoDateTime('2026-09-10T12:00:00.000Z')
const fingerprint = (label: string) =>
  `sha256:${createHash('sha256').update(`${fixtureToken}-${label}`).digest('hex')}`
const originalFingerprint = fingerprint('original')
const updatedFingerprint = fingerprint('updated')
const versionedOriginalFingerprint = fingerprint('versioned-original')

function recipeImport(
  overrides: Partial<RecipeImportDocument> = {},
): RecipeImportDocument {
  const id = overrides._id ?? crypto.randomUUID()
  return {
    _id: id,
    userId: ownerId,
    idempotencyKey: `${fixtureToken}-${id}`,
    sourceUrl,
    status: 'preview-ready',
    attemptCount: 1,
    submittedAt: timestamp,
    updatedAt: timestamp,
    canonicalUrl,
    sourceDomain: `source-${fixtureToken}.test`,
    sourceTitle: `${fixtureToken} source title`,
    sourceAuthor: 'Synthetic source author',
    importer: 'schema-org-json-ld',
    acquiredAt: timestamp,
    acquisitionMethod: 'server-fetch',
    contentFingerprint: originalFingerprint,
    rightsStatus: 'unknown',
    preview: {
      title: `${fixtureToken} imported soup`,
      typicalPeopleFed: 4,
      ingredients: [
        {
          originalText: '2 carrots',
          quantity: '2',
          unit: 'each',
          ingredientName: 'carrots',
          normalizedIdentity: 'carrots',
          parserConfidence: 'high',
          optional: false,
        },
      ],
      instructions: ['Simmer the soup.'],
      sourceName: `${fixtureToken} source`,
      sourceUrl,
      warnings: [],
    },
    ...overrides,
  }
}

function requestBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    title: `${fixtureToken} imported soup`,
    typicalPeopleFed: 4,
    sourceName: `${fixtureToken} source`,
    sourceUrl,
    sourceAuthor: 'Synthetic source author',
    attribution: 'Synthetic fixture for integration testing.',
    ingredients: [
      {
        originalText: '2 carrots',
        quantity: '2',
        unit: 'each',
        ingredientName: 'carrots',
        normalizedIdentity: 'carrots',
        parserConfidence: 'high',
        optional: false,
      },
    ],
    instructions: ['Simmer the soup.'],
    ...overrides,
  }
}

function saveContext(importId: string) {
  return { params: Promise.resolve({ importId }) }
}

async function ensureRecipeSearchIndex(db: Db) {
  const recipes = db.collection('recipes')
  const indexes = await recipes.listIndexes().toArray()
  const existingTextIndex = indexes.find((index) =>
    Object.values(index.key ?? {}).some((value) => value === 'text'),
  )

  if (
    existingTextIndex?.name &&
    existingTextIndex.name !== 'recipe_public_search_text'
  ) {
    await recipes.dropIndex(existingTextIndex.name)
  }

  if (!indexes.some((index) => index.name === 'recipe_public_search_text')) {
    await recipes.createIndex(
      {
        title: 'text',
        'ingredients.originalText': 'text',
        'ingredients.ingredientName': 'text',
        sourceName: 'text',
        sourceAuthor: 'text',
        sourceUrl: 'text',
        cuisine: 'text',
        tags: 'text',
        dietaryLabels: 'text',
      },
      {
        name: 'recipe_public_search_text',
        weights: {
          title: 10,
          'ingredients.ingredientName': 8,
          'ingredients.originalText': 5,
          sourceName: 4,
          cuisine: 3,
          tags: 3,
          dietaryLabels: 3,
          sourceAuthor: 2,
          sourceUrl: 1,
        },
      },
    )
  }
}

describe('Mongo-backed public recipe import workflow', () => {
  let db: Db

  beforeAll(async () => {
    if (!/(?:^|_)(?:test|ci)(?:_|$)/.test(databaseName)) {
      throw new Error(
        'Integration tests require MONGODB_DATABASE to contain test or ci; refusing to write to a development database.',
      )
    }

    db = await getConnectedDatabase()
    await ensureRecipeSearchIndex(db)
  })

  afterAll(async () => {
    if (!db) return
    const importedRecipes = await db
      .collection<RecipeDraftDocument>('recipes')
      .find({ 'importProvenance.submittedUrl': { $regex: fixtureToken } })
      .project({ _id: 1 })
      .toArray()
    const recipeIds = importedRecipes.map((recipe) => recipe._id)

    await db.collection<RecipeImportDocument>('recipe_imports').deleteMany({
      sourceUrl: { $regex: fixtureToken },
    })
    await db.collection<RecipeDraftDocument>('recipes').deleteMany({
      'importProvenance.submittedUrl': { $regex: fixtureToken },
    })
    if (recipeIds.length > 0) {
      await db.collection<RecipeVersionDocument>('recipe_versions').deleteMany({
        recipeId: { $in: recipeIds },
      })
    }
    await getMongoClient().close()
  })

  it('publishes complete provenance, supports discovery, and preserves private boundaries', async () => {
    const publicImport = recipeImport()
    const privateImport = recipeImport({
      sourceUrl: `${sourceUrl}/incomplete`,
      canonicalUrl: `${canonicalUrl}/incomplete`,
      contentFingerprint: fingerprint('incomplete'),
      preview: {
        ...recipeImport().preview!,
        title: `${fixtureToken} incomplete import`,
        ingredients: [],
        instructions: [],
        sourceUrl: `${sourceUrl}/incomplete`,
      },
    })
    await db
      .collection<RecipeImportDocument>('recipe_imports')
      .insertMany([publicImport, privateImport])

    getSession.mockResolvedValue({ user: { id: ownerId } })
    const publicSave = await saveImport(
      new Request('http://localhost/api/v1/imports/save', {
        method: 'POST',
        body: JSON.stringify(requestBody()),
      }),
      saveContext(publicImport._id),
    )
    expect(publicSave.status).toBe(201)
    const publicRecipe = (await publicSave.json()).recipe as {
      id: string
      visibility: string
      importProvenance: Record<string, unknown>
    }
    expect(publicRecipe.visibility).toBe('public')
    expect(publicRecipe.importProvenance).toMatchObject({
      submittedUrl: sourceUrl,
      canonicalUrl,
      sourceDomain: `source-${fixtureToken}.test`,
      sourceTitle: `${fixtureToken} source title`,
      sourceAuthor: 'Synthetic source author',
      importer: 'schema-org-json-ld',
      acquiredAt: timestamp,
      acquisitionMethod: 'server-fetch',
      contentFingerprint: originalFingerprint,
      versionRelationship: 'source-original',
      rightsStatus: 'unknown',
    })

    const savedVersion = await db
      .collection<RecipeVersionDocument>('recipe_versions')
      .findOne({ recipeId: publicRecipe.id })
    expect(savedVersion).toMatchObject({
      recipeId: publicRecipe.id,
      importProvenance: expect.objectContaining({
        contentFingerprint: originalFingerprint,
      }),
    })

    const publicSearch = await new MongoRecipeSearchProvider(db).searchRecipes({
      text: `${fixtureToken} imported`,
    })
    expect(publicSearch.results.map(({ id }) => id)).toContain(publicRecipe.id)

    const library = await findRecipeLibrary(db, ownerId)
    expect(library.map(({ recipe }) => recipe.id)).toContain(publicRecipe.id)

    const privateSave = await saveImport(
      new Request('http://localhost/api/v1/imports/save', {
        method: 'POST',
        body: JSON.stringify(
          requestBody({
            title: `${fixtureToken} incomplete import`,
            sourceUrl: `${sourceUrl}/incomplete`,
            ingredients: [],
            instructions: [],
          }),
        ),
      }),
      saveContext(privateImport._id),
    )
    expect(privateSave.status).toBe(201)
    const privateRecipe = (await privateSave.json()).recipe as {
      id: string
      visibility: string
      status: string
    }
    expect(privateRecipe).toMatchObject({
      visibility: 'private',
      status: 'draft',
    })

    getSession.mockResolvedValue({ user: { id: outsiderId } })
    const privateRead = await getRecipe(
      new Request(`http://localhost/api/v1/recipes/${privateRecipe.id}`),
      { params: Promise.resolve({ recipeId: privateRecipe.id }) },
    )
    expect(privateRead.status).toBe(404)

    const privateSearch = await new MongoRecipeSearchProvider(db).searchRecipes(
      { text: `${fixtureToken} incomplete` },
    )
    expect(privateSearch.results.map(({ id }) => id)).not.toContain(
      privateRecipe.id,
    )
  })

  it('reuses exact public identities and allows an explicitly confirmed source update', async () => {
    const originalImport = recipeImport({
      sourceUrl: versionedSourceUrl,
      canonicalUrl: versionedCanonicalUrl,
      contentFingerprint: versionedOriginalFingerprint,
      preview: {
        ...recipeImport().preview!,
        sourceUrl: versionedSourceUrl,
      },
    })
    const duplicateImport = recipeImport({
      sourceUrl: `${versionedSourceUrl}?duplicate=1`,
      canonicalUrl: versionedCanonicalUrl,
      contentFingerprint: versionedOriginalFingerprint,
      preview: {
        ...recipeImport().preview!,
        sourceUrl: `${versionedSourceUrl}?duplicate=1`,
      },
    })
    const updatedImport = recipeImport({
      sourceUrl: `${versionedSourceUrl}?revision=2`,
      canonicalUrl: versionedCanonicalUrl,
      contentFingerprint: updatedFingerprint,
      preview: {
        ...recipeImport().preview!,
        title: `${fixtureToken} updated imported soup`,
        sourceUrl: `${versionedSourceUrl}?revision=2`,
      },
    })
    await db
      .collection<RecipeImportDocument>('recipe_imports')
      .insertMany([originalImport, duplicateImport, updatedImport])

    getSession.mockResolvedValue({ user: { id: ownerId } })
    const originalSave = await saveImport(
      new Request('http://localhost/api/v1/imports/save', {
        method: 'POST',
        body: JSON.stringify(requestBody({ sourceUrl: versionedSourceUrl })),
      }),
      saveContext(originalImport._id),
    )
    expect(originalSave.status).toBe(201)
    const originalRecipeId = (await originalSave.json()).recipe.id as string

    const duplicateSave = await saveImport(
      new Request('http://localhost/api/v1/imports/save', {
        method: 'POST',
        body: JSON.stringify(
          requestBody({
            title: 'A duplicate title',
            sourceUrl: versionedSourceUrl,
          }),
        ),
      }),
      saveContext(duplicateImport._id),
    )
    expect(duplicateSave.status).toBe(409)
    const duplicateBody = await duplicateSave.json()
    expect(duplicateBody).toMatchObject({
      code: 'IMPORT_DUPLICATE',
      existingRecipe: { id: originalRecipeId },
    })

    const proposal = await saveImport(
      new Request('http://localhost/api/v1/imports/save', {
        method: 'POST',
        body: JSON.stringify(
          requestBody({
            title: `${fixtureToken} updated imported soup`,
            sourceUrl: versionedSourceUrl,
          }),
        ),
      }),
      saveContext(updatedImport._id),
    )
    expect(proposal.status).toBe(409)
    expect(await proposal.json()).toMatchObject({
      code: 'IMPORT_RELATED_VERSION',
      relatedRecipe: {
        id: originalRecipeId,
        relationship: 'source-update',
      },
    })

    const confirmed = await saveImport(
      new Request('http://localhost/api/v1/imports/save', {
        method: 'POST',
        body: JSON.stringify(
          requestBody({
            title: `${fixtureToken} updated imported soup`,
            sourceUrl: versionedSourceUrl,
            acceptRelatedVersion: true,
          }),
        ),
      }),
      saveContext(updatedImport._id),
    )
    expect(confirmed.status).toBe(201)
    const updatedRecipe = (await confirmed.json()).recipe as {
      id: string
      importProvenance: Record<string, unknown>
    }
    expect(updatedRecipe.id).not.toBe(originalRecipeId)
    expect(updatedRecipe.importProvenance).toMatchObject({
      canonicalUrl: versionedCanonicalUrl,
      contentFingerprint: updatedFingerprint,
      versionRelationship: 'source-update',
      relatedRecipeId: originalRecipeId,
    })

    const publicVersions = await db
      .collection<RecipeVersionDocument>('recipe_versions')
      .find({ recipeId: { $in: [originalRecipeId, updatedRecipe.id] } })
      .toArray()
    expect(publicVersions).toHaveLength(2)
    expect(
      publicVersions.map(
        (version) => version.importProvenance?.contentFingerprint,
      ),
    ).toEqual(
      expect.arrayContaining([
        versionedOriginalFingerprint,
        updatedFingerprint,
      ]),
    )

    const discovered = await new MongoRecipeSearchProvider(db).searchRecipes({
      text: fixtureToken,
    })
    expect(discovered.results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([originalRecipeId, updatedRecipe.id]),
    )
  })
})
