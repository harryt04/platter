import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Db } from 'mongodb'
import { GET } from '@/app/api/v1/recipes/[recipeId]/route'
import { isoDateTime } from '@/lib/contracts/ids'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import type { ListDocument } from '@/lib/lists'
import type {
  RecipeDraftDocument,
  RecipeShareDocument,
  RecipeVersionDocument,
} from '@/lib/recipes/drafts'
import { MongoRecipeSearchProvider } from '@/lib/search/mongo-provider'
import { resolveRunRecipeVersions } from '@/lib/recipes/versions'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))

const databaseName = process.env.MONGODB_DATABASE ?? ''
const fixtureToken = `platterintegration${Date.now()}`
const ownerId = `${fixtureToken}-owner`
const memberId = `${fixtureToken}-member`
const outsiderId = `${fixtureToken}-outsider`
const listId = `${fixtureToken}-list`
const publicRecipeId = `${fixtureToken}-public`
const privateRecipeId = `${fixtureToken}-private`
const sharedRecipeId = `${fixtureToken}-shared`
const pendingRecipeId = `${fixtureToken}-pending`
const historicalRecipeId = `${fixtureToken}-historical`
const historicalVersionId = `${fixtureToken}-version-1`
const rankingToken = `${fixtureToken}ranking`
const filterToken = `${fixtureToken}filter`
const paginationToken = `${fixtureToken}pagination`
const performanceToken = `${fixtureToken}performance`
const rankingRecipeIds = [
  `${fixtureToken}-ranking-title`,
  `${fixtureToken}-ranking-ingredient`,
  `${fixtureToken}-ranking-source`,
]
const filterRecipeIds = [
  `${fixtureToken}-filter-match`,
  `${fixtureToken}-filter-mismatch`,
]
const paginationRecipeIds = Array.from(
  { length: 5 },
  (_, index) => `${fixtureToken}-pagination-${index}`,
)
const performanceRecipeIds = Array.from(
  { length: 100 },
  (_, index) => `${fixtureToken}-performance-${index}`,
)

const timestamp = isoDateTime('2026-09-10T12:00:00.000Z')

function recipeDocument(
  id: string,
  visibility: 'private' | 'list-shared' | 'public',
) {
  return {
    _id: id,
    ownerId,
    title: `${fixtureToken} visibility recipe`,
    status: 'usable' as const,
    origin: 'authored' as const,
    importReviewStatus: 'not-required' as const,
    visibility,
    versionId: `${id}-version-1`,
    versionNumber: 1,
    typicalPeopleFed: 4,
    ingredients: [
      {
        originalText: '2 onions',
        quantity: '2',
        unit: 'each',
        ingredientName: 'onions',
        optional: false,
      },
    ],
    instructions: ['Prepare the onions.'],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function publicSearchRecipe(
  id: string,
  overrides: Partial<RecipeDraftDocument> = {},
) {
  return {
    ...recipeDocument(id, 'public'),
    sourceName: 'Synthetic kitchen',
    ...overrides,
  }
}

async function ensureWeightedRecipeSearchIndex(db: Db) {
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

  const hasWeightedIndex = indexes.some(
    (index) => index.name === 'recipe_public_search_text',
  )
  if (!hasWeightedIndex) {
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

describe('recipe visibility and immutable versions', () => {
  let db: Db

  beforeAll(async () => {
    if (!/(?:^|_)(?:test|ci)(?:_|$)/.test(databaseName)) {
      throw new Error(
        'Integration tests require MONGODB_DATABASE to contain test or ci; refusing to write to a development database.',
      )
    }

    db = await getConnectedDatabase()
    await ensureWeightedRecipeSearchIndex(db)

    await db.collection<RecipeDraftDocument>('recipes').insertMany([
      recipeDocument(privateRecipeId, 'private'),
      recipeDocument(sharedRecipeId, 'list-shared'),
      recipeDocument(publicRecipeId, 'public'),
      {
        ...recipeDocument(pendingRecipeId, 'public'),
        origin: 'imported' as const,
        importReviewStatus: 'pending' as const,
      },
      {
        ...recipeDocument(historicalRecipeId, 'private'),
        title: `${fixtureToken} historical version`,
        versionId: `${historicalRecipeId}-version-2`,
        versionNumber: 2,
      },
      publicSearchRecipe(rankingRecipeIds[0], {
        title: `${rankingToken} title match`,
        ingredients: [
          {
            originalText: '2 onions',
            quantity: '2',
            unit: 'each',
            ingredientName: 'onions',
            optional: false,
          },
        ],
      }),
      publicSearchRecipe(rankingRecipeIds[1], {
        title: 'Ingredient match',
        ingredients: [
          {
            originalText: `2 ${rankingToken}`,
            quantity: '2',
            unit: 'each',
            ingredientName: rankingToken,
            optional: false,
          },
        ],
      }),
      publicSearchRecipe(rankingRecipeIds[2], {
        title: 'Source match',
        sourceName: rankingToken,
      }),
      publicSearchRecipe(filterRecipeIds[0], {
        title: `${filterToken} matching recipe`,
        cuisine: 'Mexican',
        tags: ['quick', 'weeknight'],
        dietaryLabels: ['vegetarian'],
      }),
      publicSearchRecipe(filterRecipeIds[1], {
        title: `${filterToken} non-matching recipe`,
        cuisine: 'Italian',
        tags: ['quick'],
        dietaryLabels: ['vegetarian'],
      }),
      ...paginationRecipeIds.map((id) =>
        publicSearchRecipe(id, { title: `${paginationToken} recipe` }),
      ),
      ...performanceRecipeIds.map((id, index) =>
        publicSearchRecipe(id, {
          title: `${performanceToken} recipe ${index}`,
        }),
      ),
    ])
    await db.collection<ListDocument>('lists').insertOne({
      _id: listId,
      name: `${fixtureToken} shared list`,
      ownerIds: [ownerId],
      status: 'active',
      activeRunId: `${listId}-run`,
      members: [
        { userId: ownerId, role: 'owner', invitationState: 'active' },
        { userId: memberId, role: 'editor', invitationState: 'active' },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await db.collection<RecipeShareDocument>('recipe_shares').insertOne({
      _id: `${fixtureToken}-share`,
      recipeId: sharedRecipeId,
      listId,
      ownerId,
      createdAt: timestamp,
    })

    await db.collection<RecipeVersionDocument>('recipe_versions').insertOne({
      ...recipeDocument(historicalRecipeId, 'private'),
      _id: historicalVersionId,
      title: `${fixtureToken} historical title`,
      versionNumber: 1,
      recipeId: historicalRecipeId,
    })
  })

  afterAll(async () => {
    if (!db) return
    await db.collection<RecipeDraftDocument>('recipes').deleteMany({
      _id: {
        $regex: `^${fixtureToken}`,
      },
    })
    await db.collection<ListDocument>('lists').deleteOne({ _id: listId })
    await db
      .collection<RecipeShareDocument>('recipe_shares')
      .deleteOne({ _id: `${fixtureToken}-share` })
    await db
      .collection<RecipeVersionDocument>('recipe_versions')
      .deleteOne({ _id: historicalVersionId })
    await getMongoClient().close()
  })

  it('keeps private, list-shared, and public reads in their intended boundaries', async () => {
    getSession.mockResolvedValue({ user: { id: ownerId } })
    const privateResponse = await GET(
      new Request(`http://localhost/api/v1/recipes/${privateRecipeId}`),
      { params: Promise.resolve({ recipeId: privateRecipeId }) },
    )
    expect(privateResponse.status).toBe(200)

    getSession.mockResolvedValue({ user: { id: memberId } })
    const sharedResponse = await GET(
      new Request(`http://localhost/api/v1/recipes/${sharedRecipeId}`),
      { params: Promise.resolve({ recipeId: sharedRecipeId }) },
    )
    expect(sharedResponse.status).toBe(200)

    getSession.mockResolvedValue({ user: { id: outsiderId } })
    const deniedResponse = await GET(
      new Request(`http://localhost/api/v1/recipes/${sharedRecipeId}`),
      { params: Promise.resolve({ recipeId: sharedRecipeId }) },
    )
    expect(deniedResponse.status).toBe(404)

    const search = new MongoRecipeSearchProvider(db)
    const publicResults = await search.searchRecipes({ text: fixtureToken })
    expect(publicResults.results.map(({ id }) => id)).toEqual([publicRecipeId])

    const privateResults = await search.searchRecipes({
      text: fixtureToken,
      ownerId,
      filters: { visibility: 'private' },
    })
    expect(privateResults.results.map(({ id }) => id)).toEqual([
      historicalRecipeId,
      privateRecipeId,
    ])
  })

  it('resolves a pinned historical version after the mutable recipe changes', async () => {
    await db.collection<RecipeDraftDocument>('recipes').updateOne(
      { _id: historicalRecipeId },
      {
        $set: {
          title: `${fixtureToken} current title`,
          versionId: `${historicalRecipeId}-version-3`,
          versionNumber: 3,
        },
      },
    )

    const [resolution] = await resolveRunRecipeVersions(db, [
      {
        recipeId: historicalRecipeId,
        versionId: historicalVersionId,
        versionNumber: 1,
      },
    ])

    expect(resolution.version).toMatchObject({
      _id: historicalVersionId,
      title: `${fixtureToken} historical title`,
      versionNumber: 1,
    })
  })

  it('verifies weighted fields, filters, visibility, and stable cursor pagination', async () => {
    const search = new MongoRecipeSearchProvider(db)
    const searchIndex = (
      await db.collection('recipes').listIndexes().toArray()
    ).find((index) => index.name === 'recipe_public_search_text')

    expect(searchIndex?.weights).toMatchObject({
      title: 10,
      'ingredients.ingredientName': 8,
      sourceName: 4,
    })

    const rankingResults = await search.searchRecipes({ text: rankingToken })
    expect(rankingResults.results.map(({ id }) => id)).toEqual(rankingRecipeIds)

    const filteredResults = await search.searchRecipes({
      text: filterToken,
      filters: {
        cuisine: 'Mexican',
        tags: ['quick', 'weeknight'],
        dietaryLabels: ['vegetarian'],
      },
    })
    expect(filteredResults.results.map(({ id }) => id)).toEqual([
      filterRecipeIds[0],
    ])

    const pagedIds: string[] = []
    let cursor: string | undefined
    do {
      const page = await search.searchRecipes({
        text: paginationToken,
        cursor,
        pageSize: 2,
      })
      pagedIds.push(...page.results.map(({ id }) => id))
      cursor = page.nextCursor
    } while (cursor)

    expect(pagedIds).toEqual(paginationRecipeIds)
    expect(new Set(pagedIds).size).toBe(paginationRecipeIds.length)
  })

  it('keeps a synthetic public discovery page under the two-second target', async () => {
    const search = new MongoRecipeSearchProvider(db)
    const startedAt = performance.now()
    const response = await search.searchRecipes({
      text: performanceToken,
      pageSize: 50,
    })

    expect(response.results).toHaveLength(50)
    expect(response.nextCursor).toBeTruthy()
    expect(performance.now() - startedAt).toBeLessThan(2_000)
  })
})
