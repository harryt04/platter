import { describe, expect, it, vi } from 'vitest'
import { getAccountDeletionImpact } from '@/lib/account-deletion'

describe('getAccountDeletionImpact', () => {
  it('counts only the current user’s active memberships and owned content', async () => {
    const lists = [
      { _id: 'list-1', name: 'Family', ownerIds: ['user-1'] },
      { _id: 'list-2', name: 'Friends', ownerIds: ['user-1', 'user-2'] },
    ]
    const countDocuments = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'lists') {
          return {
            find: () => ({
              project: () => ({
                sort: () => ({ toArray: async () => lists }),
              }),
            }),
          }
        }
        return { countDocuments }
      }),
    } as never

    await expect(getAccountDeletionImpact(db, 'user-1')).resolves.toEqual({
      ownedLists: 2,
      soleOwnerLists: ['Family'],
      memberships: 2,
      manuallyAuthoredRecipes: 2,
      publicImportedRecipes: 3,
      completedShoppingRuns: 4,
    })

    expect(countDocuments).toHaveBeenNthCalledWith(1, {
      ownerId: 'user-1',
      status: { $in: ['draft', 'usable'] },
      $or: [{ origin: { $exists: false } }, { origin: 'authored' }],
    })
    expect(countDocuments).toHaveBeenNthCalledWith(2, {
      ownerId: 'user-1',
      origin: 'imported',
      importReviewStatus: 'approved',
      status: 'usable',
      visibility: 'public',
    })
    expect(countDocuments).toHaveBeenNthCalledWith(3, {
      listId: { $in: ['list-1', 'list-2'] },
    })
  })
})
