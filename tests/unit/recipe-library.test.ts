import type { Db } from 'mongodb'
import { describe, expect, it, vi } from 'vitest'
import {
  decodeRecipeLibraryCursor,
  findRecipeLibrary,
  searchRecipeLibrary,
} from '@/lib/recipes/library'
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
    limit: vi.fn(() => cursor),
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
  it('includes an imported recipe saved by the current user', async () => {
    const lists = query<ListDocument>([])
    const shares = query<RecipeShareDocument>([])
    const saves = query<RecipeSaveDocument>([])
    const recipes = query<RecipeDraftDocument>([
      recipe('imported-1', {
        origin: 'imported',
        importReviewStatus: 'approved',
        visibility: 'public',
        sourceName: 'Example Recipes',
      }),
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
        recipe: expect.objectContaining({
          id: 'imported-1',
          origin: 'imported',
          sourceName: 'Example Recipes',
        }),
        access: 'owned',
        sharedListNames: [],
      },
    ])
    expect(recipes.find).toHaveBeenCalledWith({
      status: { $in: ['draft', 'usable'] },
      $or: [{ ownerId: 'owner-1' }],
    })
  })

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
      recipe('imported-1', {
        origin: 'imported',
        importReviewStatus: 'approved',
        visibility: 'public',
      }),
      recipe('shared-1', {
        ownerId: 'owner-2',
        householdNotes: 'Owner-only note.',
      }),
      recipe('saved-1', {
        ownerId: 'owner-2',
        visibility: 'public',
        householdNotes: 'Save this note privately.',
      }),
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
        recipe: expect.objectContaining({
          id: 'imported-1',
          origin: 'imported',
          importReviewStatus: 'approved',
        }),
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
    expect(result[1]?.recipe).not.toHaveProperty('householdNotes')
    expect(result[2]?.recipe).not.toHaveProperty('householdNotes')
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

  it('searches accessible library fields and returns a stable cursor page', async () => {
    const lists = query<ListDocument>([])
    const shares = query<RecipeShareDocument>([])
    const saves = query<RecipeSaveDocument>([])
    const recipes = query<RecipeDraftDocument>([
      recipe('recipe-1', {
        updatedAt:
          '2026-09-12T12:00:00.000Z' as RecipeDraftDocument['updatedAt'],
      }),
      recipe('recipe-2', {
        updatedAt:
          '2026-09-11T12:00:00.000Z' as RecipeDraftDocument['updatedAt'],
      }),
      recipe('recipe-3', {
        updatedAt:
          '2026-09-10T12:00:00.000Z' as RecipeDraftDocument['updatedAt'],
      }),
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

    const firstPage = await searchRecipeLibrary(db, 'owner-1', {
      text: 'onion',
      pageSize: 2,
    })

    expect(firstPage.entries.map(({ recipe: item }) => item.id)).toEqual([
      'recipe-1',
      'recipe-2',
    ])
    expect(firstPage.nextCursor).toBeDefined()
    expect(decodeRecipeLibraryCursor(firstPage.nextCursor ?? '')).toEqual({
      updatedAt: '2026-09-11T12:00:00.000Z',
      id: 'recipe-2',
    })
    expect(recipes.find).toHaveBeenCalledWith({
      status: { $in: ['draft', 'usable'] },
      $text: { $search: 'onion' },
      $and: [{ $or: [{ ownerId: 'owner-1' }] }],
    })

    await searchRecipeLibrary(db, 'owner-1', {
      cursor: firstPage.nextCursor,
      pageSize: 2,
    })

    expect(recipes.find).toHaveBeenLastCalledWith({
      status: { $in: ['draft', 'usable'] },
      $and: [
        { $or: [{ ownerId: 'owner-1' }] },
        {
          $or: [
            { updatedAt: { $lt: '2026-09-11T12:00:00.000Z' } },
            {
              updatedAt: '2026-09-11T12:00:00.000Z',
              _id: { $gt: 'recipe-2' },
            },
          ],
        },
      ],
    })
  })
})
