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

describe('recipe visibility and immutable versions', () => {
  let db: Db

  beforeAll(async () => {
    if (!/(?:^|_)(?:test|ci)(?:_|$)/.test(databaseName)) {
      throw new Error(
        'Integration tests require MONGODB_DATABASE to contain test or ci; refusing to write to a development database.',
      )
    }

    db = await getConnectedDatabase()
    await db
      .collection('recipes')
      .createIndex({ title: 'text' }, { name: 'recipe_integration_title_text' })

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
        $in: [
          privateRecipeId,
          sharedRecipeId,
          publicRecipeId,
          pendingRecipeId,
          historicalRecipeId,
        ],
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
})
