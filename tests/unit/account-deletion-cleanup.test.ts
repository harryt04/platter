import { describe, expect, it, vi } from 'vitest'
import {
  anonymizePublicImportedAccountContent,
  deletePrivateAccountContent,
  deletedAccountOwnerId,
} from '@/lib/account-deletion'

function collectionWithToArray<T>(documents: T[]) {
  return {
    find: vi.fn(() => ({
      project: () => ({ toArray: async () => documents }),
    })),
  }
}

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

describe('anonymizePublicImportedAccountContent', () => {
  it('preserves public imported facts and provenance while detaching ownership', async () => {
    const publicRecipe = {
      _id: 'recipe-public-import',
      ownerId: 'user-1',
      origin: 'imported',
      importReviewStatus: 'approved',
      status: 'usable',
      visibility: 'public',
      title: 'Public soup',
      sourceName: 'Synthetic Kitchen',
      importProvenance: {
        canonicalUrl: 'https://example.test/soup',
        sourceDomain: 'example.test',
        rightsStatus: 'unknown',
      },
    }
    const recipes = {
      ...collectionWithToArray([publicRecipe]),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    }
    const versions = {
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    }
    const db = {
      collection: vi.fn((name: string) =>
        name === 'recipes' ? recipes : versions,
      ),
    } as never

    await expect(
      anonymizePublicImportedAccountContent(db, 'user-1'),
    ).resolves.toEqual({
      anonymizedPublicRecipes: 1,
      anonymizedPublicVersions: 1,
    })
    expect(recipes.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $in: ['recipe-public-import'] },
        ownerId: 'user-1',
        visibility: 'public',
      }),
      { $set: expect.objectContaining({ ownerId: deletedAccountOwnerId }) },
    )
    expect(versions.updateMany).toHaveBeenCalledWith(
      { recipeId: { $in: ['recipe-public-import'] }, ownerId: 'user-1' },
      { $set: { ownerId: deletedAccountOwnerId } },
    )
  })

  it('does not change recipes that are private, pending, or owned by another account', async () => {
    const recipes = {
      ...collectionWithToArray([]),
      updateMany: vi.fn(),
    }
    const db = {
      collection: vi.fn(() => recipes),
    } as never

    await expect(
      anonymizePublicImportedAccountContent(db, 'user-1'),
    ).resolves.toEqual({
      anonymizedPublicRecipes: 0,
      anonymizedPublicVersions: 0,
    })
    expect(recipes.updateMany).not.toHaveBeenCalled()
  })
})
