import { describe, expect, it, vi } from 'vitest'
import { createRecipeSearchProvider } from '@/lib/search/default-provider'
import {
  encodeRecipeSearchCursor,
  MongoRecipeSearchProvider,
} from '@/lib/search/mongo-provider'

function createDatabase(documents: object[] = []) {
  const cursor = {
    toArray: vi.fn().mockResolvedValue(documents),
  }
  const collection = { aggregate: vi.fn().mockReturnValue(cursor) }
  return {
    db: { collection: vi.fn().mockReturnValue(collection) },
    collection,
  }
}

describe('MongoRecipeSearchProvider', () => {
  it('uses MongoDB as the default provider without a hosted search dependency', () => {
    const { db } = createDatabase()

    expect(createRecipeSearchProvider(db as never)).toBeInstanceOf(
      MongoRecipeSearchProvider,
    )
  })

  it('uses the public recipe contract for discovery by default', async () => {
    const { db, collection } = createDatabase()

    await new MongoRecipeSearchProvider(db as never).searchRecipes({
      text: 'soup',
    })

    const pipeline = collection.aggregate.mock.calls[0][0]
    expect(pipeline[0]).toEqual({
      $match: {
        status: 'usable',
        visibility: 'public',
        $or: [
          { origin: { $exists: false } },
          { origin: 'authored' },
          { origin: 'imported', importReviewStatus: 'approved' },
        ],
        $text: { $search: 'soup' },
      },
    })
    expect(pipeline).toContainEqual({
      $lookup: {
        from: 'recipe_saves',
        localField: '_id',
        foreignField: 'recipeId',
        as: 'engagementSaves',
      },
    })
    expect(pipeline).toContainEqual({ $sort: { rankScore: -1, _id: 1 } })
  })

  it('scopes private searches to an owner and permits only private drafts', async () => {
    const { db, collection } = createDatabase()

    await new MongoRecipeSearchProvider(db as never).searchRecipes({
      text: '',
      ownerId: 'user-1',
      filters: { visibility: 'private' },
    })

    expect(collection.aggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        ownerId: 'user-1',
        status: { $in: ['draft', 'usable'] },
        visibility: 'private',
      },
    })
  })

  it('returns no private results when the caller omits the owner boundary', async () => {
    const { db, collection } = createDatabase()

    await new MongoRecipeSearchProvider(db as never).searchRecipes({
      text: 'soup',
      filters: { visibility: 'private' },
    })

    expect(collection.aggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        _id: { $in: [] },
        $text: { $search: 'soup' },
      },
    })
  })

  it('returns public discovery metadata and only permitted images', async () => {
    const { db } = createDatabase([
      {
        _id: 'recipe-1',
        title: 'Tomato soup',
        sourceName: 'Synthetic kitchen',
        sourceUrl: 'https://example.com/soup',
        sourceAuthor: 'Alex Rivera',
        attribution: 'Adapted with permission.',
        description: 'A quick soup.',
        typicalPeopleFed: 4,
        cuisine: 'Italian',
        tags: ['weeknight'],
        dietaryLabels: ['vegetarian'],
        image: {
          url: 'https://example.com/soup.jpg',
          altText: 'A bowl of soup',
          rightsStatus: 'licensed',
        },
        visibility: 'public',
        rankScore: 6.25,
      },
      {
        _id: 'recipe-2',
        title: 'Private soup',
        visibility: 'public',
        image: {
          url: 'https://example.com/private.jpg',
          rightsStatus: 'unknown',
        },
      },
      {
        _id: 'recipe-imported',
        title: 'Imported soup',
        origin: 'imported',
        importReviewStatus: 'approved',
        visibility: 'public',
        importProvenance: {
          canonicalUrl: 'https://example.com/recipes/imported-soup',
          submittedUrl: 'https://example.com/recipes/imported-soup?ref=1',
          sourceDomain: 'example.com',
          sourceAuthor: 'Alex Rivera',
        },
        rankScore: -1,
      },
    ])

    const response = await new MongoRecipeSearchProvider(
      db as never,
    ).searchRecipes({
      text: 'soup',
    })

    expect(response.results).toEqual([
      {
        id: 'recipe-1',
        title: 'Tomato soup',
        source: 'Synthetic kitchen',
        sourceUrl: 'https://example.com/soup',
        sourceAuthor: 'Alex Rivera',
        attribution: 'Adapted with permission.',
        score: '6.25',
        visibility: 'public',
        typicalPeopleFed: 4,
        summary: 'A quick soup.',
        cuisine: 'Italian',
        tags: ['weeknight'],
        dietaryLabels: ['vegetarian'],
        image: {
          url: 'https://example.com/soup.jpg',
          altText: 'A bowl of soup',
        },
      },
      {
        id: 'recipe-2',
        title: 'Private soup',
        source: 'Platter community',
        score: '0',
        visibility: 'public',
      },
      {
        id: 'recipe-imported',
        title: 'Imported soup',
        source: 'example.com',
        sourceUrl: 'https://example.com/recipes/imported-soup',
        sourceAuthor: 'Alex Rivera',
        score: '-1',
        visibility: 'public',
      },
    ])
  })

  it('uses completeness and capped saves as deterministic ranking inputs', async () => {
    const { db, collection } = createDatabase()

    await new MongoRecipeSearchProvider(db as never).searchRecipes({
      text: '',
      pageSize: 7,
    })

    const pipeline = collection.aggregate.mock.calls[0][0]
    expect(pipeline).toContainEqual({
      $set: {
        completenessScore: {
          $add: [
            {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$ingredients', []] } }, 0] },
                1,
                0,
              ],
            },
            {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$instructions', []] } }, 0] },
                1,
                0,
              ],
            },
            {
              $cond: [
                { $gt: [{ $ifNull: ['$typicalPeopleFed', 0] }, 0] },
                1,
                0,
              ],
            },
            {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ['$sourceName', ''] } }, 0] },
                1,
                0,
              ],
            },
            {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ['$description', ''] } }, 0] },
                1,
                0,
              ],
            },
            {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ['$sourceUrl', ''] } }, 0] },
                1,
                0,
              ],
            },
            {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ['$attribution', ''] } }, 0] },
                1,
                0,
              ],
            },
            {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ['$image.url', ''] } }, 0] },
                1,
                0,
              ],
            },
          ],
        },
      },
    })
    expect(pipeline).toContainEqual({
      $sort: { rankScore: -1, _id: 1 },
    })
    expect(pipeline).toContainEqual({
      $set: {
        rankScore: {
          $add: [
            0,
            { $multiply: ['$completenessScore', 0.25] },
            {
              $multiply: [{ $min: [{ $size: '$engagementSaves' }, 10] }, 0.05],
            },
          ],
        },
      },
    })
    expect(pipeline).toContainEqual({ $limit: 8 })
  })

  it('composes public filters and advances with a rank and id cursor', async () => {
    const { db, collection } = createDatabase([
      { _id: 'recipe-1', title: 'First', rankScore: 4 },
      { _id: 'recipe-2', title: 'Second', rankScore: 3 },
      { _id: 'recipe-3', title: 'Third', rankScore: 2 },
    ])

    const response = await new MongoRecipeSearchProvider(
      db as never,
    ).searchRecipes({
      text: 'beans',
      cursor: encodeRecipeSearchCursor({ rankScore: 4, id: 'recipe-1' }),
      pageSize: 2,
      filters: {
        cuisine: 'Mexican',
        tags: ['weeknight', 'quick'],
        dietaryLabels: ['vegetarian'],
      },
    })

    const pipeline = collection.aggregate.mock.calls[0][0]
    expect(pipeline[0]).toEqual({
      $match: {
        status: 'usable',
        visibility: 'public',
        $or: [
          { origin: { $exists: false } },
          { origin: 'authored' },
          { origin: 'imported', importReviewStatus: 'approved' },
        ],
        $text: { $search: 'beans' },
        cuisine: 'Mexican',
        tags: { $all: ['weeknight', 'quick'] },
        dietaryLabels: { $all: ['vegetarian'] },
      },
    })
    expect(pipeline).toContainEqual({
      $match: {
        $or: [
          { rankScore: { $lt: 4 } },
          { rankScore: 4, _id: { $gt: 'recipe-1' } },
        ],
      },
    })
    expect(pipeline).toContainEqual({ $limit: 3 })
    expect(response.nextCursor).toBeTruthy()
  })

  it('returns an opaque next cursor only when another page exists', async () => {
    const { db } = createDatabase([
      { _id: 'recipe-1', title: 'First', rankScore: 4 },
      { _id: 'recipe-2', title: 'Second', rankScore: 3 },
    ])

    const response = await new MongoRecipeSearchProvider(
      db as never,
    ).searchRecipes({ text: '', pageSize: 1 })

    expect(response.results).toHaveLength(1)
    expect(response.nextCursor).toBeTruthy()
  })
})
