import { describe, expect, it } from 'vitest'
import { createAccountExport } from '@/lib/account-exports'
import { isoDateTime } from '@/lib/contracts/ids'
import type { ListDocument } from '@/lib/lists'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'
import type { RecipeImportDocument } from '@/lib/recipe-imports'
import type { RecipeSaveDocument } from '@/lib/recipes/saves'
import type { ShoppingRunHistoryDocument } from '@/lib/shopping-run-history'

function cursor<T>(documents: T[]) {
  const chain = {
    find: () => chain,
    project: () => chain,
    sort: () => chain,
    toArray: async () => documents,
  }
  return chain
}

describe('createAccountExport', () => {
  it('includes only the account’s scoped data and omits other member details', async () => {
    const list: ListDocument = {
      _id: 'list-1',
      name: 'Family',
      ownerIds: ['user-1', 'user-2'],
      status: 'active',
      activeRunId: 'run-1',
      members: [
        { userId: 'user-1', role: 'owner', invitationState: 'active' },
        { userId: 'user-2', role: 'editor', invitationState: 'active' },
      ],
      createdAt: isoDateTime('2026-09-01T00:00:00.000Z'),
      updatedAt: isoDateTime('2026-09-01T00:00:00.000Z'),
    }
    const recipe = {
      _id: 'recipe-1',
      ownerId: 'user-1',
      title: 'Pasta',
      status: 'draft',
      visibility: 'private',
      ingredients: [],
      instructions: [],
      createdAt: isoDateTime('2026-09-01T00:00:00.000Z'),
      updatedAt: isoDateTime('2026-09-01T00:00:00.000Z'),
    } as RecipeDraftDocument
    const save = {
      _id: 'save-1',
      userId: 'user-1',
      recipeId: 'public-recipe',
      createdAt: '2026-09-01T00:00:00.000Z',
    } as RecipeSaveDocument
    const recipeImport = {
      _id: 'import-1',
      userId: 'user-1',
      idempotencyKey: 'private-request-key',
      sourceUrl: 'https://recipes.example.test/pasta',
      status: 'failed',
      attemptCount: 1,
      submittedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    } as RecipeImportDocument
    const history = {
      _id: 'history-1',
      listId: 'list-1',
      completedAt: isoDateTime('2026-09-02T00:00:00.000Z'),
      localDate: '2026-09-02',
      completedByUserId: 'user-2',
      recipeSelections: [],
    } as ShoppingRunHistoryDocument
    const collections = new Map<string, unknown[]>([
      ['lists', [list]],
      ['recipes', [recipe]],
      ['recipe_saves', [save]],
      ['recipe_imports', [recipeImport]],
      ['shopping_run_history', [history]],
    ])
    const db = {
      collection: (name: string) => cursor(collections.get(name) ?? []),
    }

    const result = await createAccountExport(
      db as never,
      {
        id: 'user-1',
        name: 'Jamie',
        email: 'jamie@example.test',
        locale: 'de-DE',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      },
      new Date('2026-09-10T00:00:00.000Z'),
    )

    expect(result.payload.account).toMatchObject({
      id: 'user-1',
      locale: 'de-DE',
    })
    expect(result.payload.memberships).toEqual([
      {
        listId: 'list-1',
        listName: 'Family',
        listStatus: 'active',
        role: 'owner',
      },
    ])
    expect(JSON.stringify(result.payload)).not.toContain('user-2')
    expect(result.payload.recipes[0]).toMatchObject({
      id: 'recipe-1',
      title: 'Pasta',
    })
    expect(result.payload.savedRecipes).toEqual([
      { _id: 'save-1', recipeId: 'public-recipe', createdAt: save.createdAt },
    ])
    expect(result.payload.imports[0]).not.toHaveProperty('idempotencyKey')
    expect(result.payload.history).toEqual([
      {
        _id: history._id,
        listId: history.listId,
        completedAt: history.completedAt,
        localDate: history.localDate,
        recipeSelections: history.recipeSelections,
        completedByCurrentUser: false,
      },
    ])
    expect(result.expiresAt).toBe('2026-09-11T00:00:00.000Z')
  })
})
