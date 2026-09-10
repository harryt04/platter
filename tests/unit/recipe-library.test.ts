import type { Db } from 'mongodb'
import { describe, expect, it, vi } from 'vitest'
import { findRecipeLibrary } from '@/lib/recipes/library'
import type { ListDocument } from '@/lib/lists'
import type {
  RecipeDraftDocument,
  RecipeShareDocument,
} from '@/lib/recipes/drafts'
import type { RecipeSaveDocument } from '@/lib/recipes/saves'

function query<T>(documents: T[]) {
  const cursor = {
    project: vi.fn(() => cursor),
    sort: vi.fn(() => cursor),
    toArray: vi.fn().mockResolvedValue(documents),
  }
  const find = vi.fn(() => cursor)
  return {
    find,
    cursor,
  }
}

function recipe(id: string, overrides: Partial<RecipeDraftDocument> = {}) {
  return {
    _id: id,
    ownerId: 'owner-1',
    title: id,
    status: 'usable' as const,
    origin: 'authored' as const,
    importReviewStatus: 'not-required' as const,
    visibility: 'list-shared' as const,
    ingredients: [],
    instructions: [],
    createdAt: '2026-09-10T12:00:00.000Z' as RecipeDraftDocument['createdAt'],
    updatedAt: '2026-09-10T12:00:00.000Z' as RecipeDraftDocument['updatedAt'],
    ...overrides,
  }
}

describe('findRecipeLibrary', () => {
  it('includes owned recipes and current-member shared recipes with deduplicated list names', async () => {
    const lists = query<ListDocument>([
      {
        _id: 'list-1',
        name: 'Family',
        ownerIds: ['owner-1'],
        status: 'active',
        activeRunId: 'run-1',
        members: [],
        createdAt: '2026-09-10T12:00:00.000Z' as ListDocument['createdAt'],
        updatedAt: '2026-09-10T12:00:00.000Z' as ListDocument['updatedAt'],
      },
      {
        _id: 'list-2',
        name: 'Family',
        ownerIds: ['owner-1'],
        status: 'archived',
        activeRunId: 'run-2',
        members: [],
        createdAt: '2026-09-10T12:00:00.000Z' as ListDocument['createdAt'],
        updatedAt: '2026-09-10T12:00:00.000Z' as ListDocument['updatedAt'],
      },
    ])
    const shares = query<RecipeShareDocument>([
      {
        _id: 'share-1',
        recipeId: 'shared-1',
        listId: 'list-1',
        ownerId: 'owner-2',
        createdAt:
          '2026-09-10T12:00:00.000Z' as RecipeShareDocument['createdAt'],
      },
      {
        _id: 'share-2',
        recipeId: 'shared-1',
        listId: 'list-2',
        ownerId: 'owner-2',
        createdAt:
          '2026-09-10T12:00:00.000Z' as RecipeShareDocument['createdAt'],
      },
    ])
    const saves = query<RecipeSaveDocument>([
      {
        _id: 'save-1',
        userId: 'owner-1',
        recipeId: 'saved-1',
        createdAt:
          '2026-09-10T12:00:00.000Z' as RecipeSaveDocument['createdAt'],
      },
    ])
    const recipes = query<RecipeDraftDocument>([
      recipe('owned-1', { visibility: 'private' }),
      recipe('shared-1', { ownerId: 'owner-2' }),
      recipe('saved-1', { ownerId: 'owner-2', visibility: 'public' }),
    ])
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'lists') return lists
        if (name === 'recipe_shares') return shares
        if (name === 'recipe_saves') return saves
        if (name === 'recipes') return recipes
        throw new Error(`Unexpected collection: ${name}`)
      }),
    } as unknown as Db

    const result = await findRecipeLibrary(db, 'owner-1')

    expect(result).toEqual([
      {
        recipe: expect.objectContaining({ id: 'owned-1', title: 'owned-1' }),
        access: 'owned',
        sharedListNames: [],
      },
      {
        recipe: expect.objectContaining({ id: 'shared-1', title: 'shared-1' }),
        access: 'shared',
        sharedListNames: ['Family'],
      },
      {
        recipe: expect.objectContaining({ id: 'saved-1', title: 'saved-1' }),
        access: 'saved',
        sharedListNames: [],
      },
    ])
    expect(lists.find).toHaveBeenCalledWith({
      status: { $ne: 'deleted' },
      members: { $elemMatch: { userId: 'owner-1', invitationState: 'active' } },
    })
    expect(recipes.find).toHaveBeenCalledWith({
      status: { $in: ['draft', 'usable'] },
      $or: [
        { ownerId: 'owner-1' },
        {
          _id: { $in: ['shared-1'] },
          status: 'usable',
          visibility: 'list-shared',
        },
        {
          _id: { $in: ['saved-1'] },
          status: 'usable',
          visibility: 'public',
          $or: [
            { origin: { $exists: false } },
            { origin: 'authored' },
            { origin: 'imported', importReviewStatus: 'approved' },
          ],
        },
      ],
    })
    expect(result).toContainEqual({
      recipe: expect.objectContaining({ id: 'saved-1', title: 'saved-1' }),
      access: 'saved',
      sharedListNames: [],
    })
  })

  it('does not query or retain shared recipes after membership access disappears', async () => {
    const lists = query<ListDocument>([])
    const shares = query<RecipeShareDocument>([])
    const saves = query<RecipeSaveDocument>([])
    const recipes = query<RecipeDraftDocument>([
      recipe('owned-1', { visibility: 'private' }),
    ])
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'lists') return lists
        if (name === 'recipe_shares') return shares
        if (name === 'recipe_saves') return saves
        if (name === 'recipes') return recipes
        throw new Error(`Unexpected collection: ${name}`)
      }),
    } as unknown as Db

    const result = await findRecipeLibrary(db, 'owner-1')

    expect(result).toHaveLength(1)
    expect(result[0]?.access).toBe('owned')
    expect(shares.find).not.toHaveBeenCalled()
    expect(recipes.find).toHaveBeenCalledWith({
      status: { $in: ['draft', 'usable'] },
      $or: [{ ownerId: 'owner-1' }],
    })
  })
})
