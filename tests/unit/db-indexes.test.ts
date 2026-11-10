import { describe, expect, it, vi } from 'vitest'
import { ensureSharedIndexes } from '@/lib/db/indexes'

describe('shared database indexes', () => {
  it('keeps the required discovery, deduplication, membership, run, and history indexes', async () => {
    const createIndex = vi.fn().mockResolvedValue('index')
    const db = {
      collection: vi.fn(() => ({ createIndex })),
    } as never

    await ensureSharedIndexes(db)

    expect(createIndex).toHaveBeenCalledWith(
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
      expect.objectContaining({ name: 'recipe_public_search_text' }),
    )
    expect(createIndex).toHaveBeenCalledWith(
      { 'importProvenance.canonicalUrl': 1 },
      {
        name: 'recipe_imported_public_canonical_url',
        partialFilterExpression: {
          status: 'usable',
          visibility: 'public',
          origin: 'imported',
          importReviewStatus: 'approved',
          'importProvenance.canonicalUrl': { $exists: true },
        },
      },
    )
    expect(createIndex).toHaveBeenCalledWith({
      'members.userId': 1,
      'members.invitationState': 1,
    })
    expect(createIndex).toHaveBeenCalledWith(
      { listId: 1, state: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { state: 'active' },
      }),
    )
    expect(createIndex).toHaveBeenCalledWith({
      listId: 1,
      localDate: -1,
      completedAt: -1,
    })
    expect(createIndex).toHaveBeenCalledWith({ occurredAt: -1 })
    expect(createIndex).toHaveBeenCalledWith({ actorId: 1, occurredAt: -1 })
  })
})
