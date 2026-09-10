import { describe, expect, it, vi } from 'vitest'
import { MongoRecipeSearchProvider } from '@/lib/search/mongo-provider'

function createDatabase(documents: object[] = []) {
  const cursor = {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(documents),
  }
  const collection = { find: vi.fn().mockReturnValue(cursor) }
  return {
    db: { collection: vi.fn().mockReturnValue(collection) },
    collection,
  }
}

describe('MongoRecipeSearchProvider', () => {
  it('uses the public recipe contract for discovery by default', async () => {
    const { db, collection } = createDatabase()

    await new MongoRecipeSearchProvider(db as never).searchRecipes({
      text: 'soup',
    })

    expect(collection.find).toHaveBeenCalledWith({
      status: 'usable',
      visibility: 'public',
      $or: [
        { origin: { $exists: false } },
        { origin: 'authored' },
        { origin: 'imported', importReviewStatus: 'approved' },
      ],
      $text: { $search: 'soup' },
    })
  })

  it('scopes private searches to an owner and permits only private drafts', async () => {
    const { db, collection } = createDatabase()

    await new MongoRecipeSearchProvider(db as never).searchRecipes({
      text: '',
      ownerId: 'user-1',
      filters: { visibility: 'private' },
    })

    expect(collection.find).toHaveBeenCalledWith({
      ownerId: 'user-1',
      status: { $in: ['draft', 'usable'] },
      visibility: 'private',
    })
  })

  it('returns no private results when the caller omits the owner boundary', async () => {
    const { db, collection } = createDatabase()

    await new MongoRecipeSearchProvider(db as never).searchRecipes({
      text: 'soup',
      filters: { visibility: 'private' },
    })

    expect(collection.find).toHaveBeenCalledWith({
      _id: { $in: [] },
      $text: { $search: 'soup' },
    })
  })
})
