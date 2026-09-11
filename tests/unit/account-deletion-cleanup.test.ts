import { describe, expect, it, vi } from 'vitest'
import {
  deletePrivateAccountContent,
  deletedAccountOwnerId,
} from '@/lib/account-deletion'

describe('deletePrivateAccountContent', () => {
  it('removes private recipes and reduces referenced versions to anonymous identities', async () => {
    const privateRecipes = [{ _id: 'recipe-private' }]
    const versions = [
      {
        _id: 'version-used',
        recipeId: 'recipe-private',
        versionNumber: 1,
        ownerId: 'user-1',
        title: 'Secret soup',
        status: 'usable',
        visibility: 'private',
        ingredients: [],
        instructions: [],
      },
      {
        _id: 'version-unused',
        recipeId: 'recipe-private',
        versionNumber: 2,
        ownerId: 'user-1',
        title: 'Older soup',
        status: 'usable',
        visibility: 'private',
        ingredients: [],
        instructions: [],
      },
    ]
    const recipes = {
      find: vi.fn(() => ({
        project: () => ({ toArray: async () => privateRecipes }),
      })),
      deleteMany: vi.fn(),
    }
    const versionCollection = {
      find: vi.fn(() => ({ toArray: async () => versions })),
      updateOne: vi.fn(),
      deleteMany: vi.fn(),
    }
    const runCollection = {
      find: vi.fn(() => ({
        project: () => ({
          toArray: async () => [
            {
              recipeSelections: [
                { _id: 'version-used', recipeId: 'recipe-private' },
              ],
            },
          ],
        }),
      })),
    }
    const historyCollection = {
      find: vi.fn(() => ({
        project: () => ({ toArray: async () => [] }),
      })),
    }
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'recipes') return recipes
        if (name === 'recipe_versions') return versionCollection
        if (name === 'shopping_runs') return runCollection
        if (name === 'shopping_run_history') return historyCollection
        return { deleteMany: vi.fn() }
      }),
    } as never

    await expect(deletePrivateAccountContent(db, 'user-1')).resolves.toEqual({
      deletedPrivateRecipes: 1,
      anonymizedHistoricalVersions: 1,
      deletedUnreferencedVersions: 1,
    })
    expect(versionCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'version-used' },
      expect.objectContaining({
        $set: expect.objectContaining({
          ownerId: deletedAccountOwnerId,
          title: 'Recipe unavailable',
          status: 'draft',
        }),
        $unset: expect.objectContaining({ ingredients: '' }),
      }),
    )
    expect(versionCollection.deleteMany).toHaveBeenCalledWith({
      recipeId: { $in: ['recipe-private'] },
      _id: { $nin: ['version-used'] },
    })
    expect(recipes.deleteMany).toHaveBeenCalledWith({
      _id: { $in: ['recipe-private'] },
      ownerId: 'user-1',
    })
  })
})
