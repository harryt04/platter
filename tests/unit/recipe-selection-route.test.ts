import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/v1/lists/[listId]/selections/[selectionId]/route'
import { POST } from '@/app/api/v1/lists/[listId]/selections/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const list = {
  _id: 'list-1',
  name: 'Family',
  ownerIds: ['user-1'],
  status: 'active' as const,
  activeRunId: 'run-1',
  members: [
    {
      userId: 'user-1',
      role: 'owner' as const,
      invitationState: 'active' as const,
    },
  ],
}

const recipe = {
  _id: 'recipe-1',
  recipeId: 'recipe-1',
  versionId: 'version-4',
  versionNumber: 4,
  ownerId: 'user-1',
  title: 'Tomato soup',
  status: 'usable' as const,
  visibility: 'private' as const,
  typicalPeopleFed: 4,
  ingredients: [],
  instructions: [],
}

function routeContext(listId = 'list-1') {
  return { params: Promise.resolve({ listId }) }
}

function updateRouteContext(selectionId = 'selection-1') {
  return {
    params: Promise.resolve({ listId: 'list-1', selectionId }),
  }
}

function databaseFor({
  currentRecipe = recipe,
  currentVersion = { ...recipe, _id: 'version-4' },
  currentRun = { revision: 1 },
}: {
  currentRecipe?: typeof recipe | null
  currentVersion?: Record<string, unknown> | null
  currentRun?: Record<string, unknown> | null
} = {}) {
  const lists = { findOne: vi.fn().mockResolvedValue(list) }
  const recipes = { findOne: vi.fn().mockResolvedValue(currentRecipe) }
  const shares = { findOne: vi.fn().mockResolvedValue(null) }
  const versions = { findOne: vi.fn().mockResolvedValue(currentVersion) }
  const runs = {
    findOne: vi.fn().mockResolvedValue(currentRun),
    findOneAndUpdate: vi.fn().mockResolvedValue(currentRun),
  }
  const collections: Record<string, unknown> = {
    lists,
    recipes,
    recipe_shares: shares,
    recipe_versions: versions,
    shopping_runs: runs,
  }
  return {
    db: {
      collection: vi.fn((name: string) => collections[name]),
    },
    lists,
    recipes,
    versions,
    runs,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('POST /api/v1/lists/[listId]/selections', () => {
  it('adds an accessible usable recipe with an immutable version and exact scale', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/selections', {
        method: 'POST',
        body: JSON.stringify({ recipeId: 'recipe-1', desiredPeople: 6 }),
      }),
      routeContext(),
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      selection: {
        recipeId: 'recipe-1',
        versionId: 'version-4',
        versionNumber: 4,
        desiredPeople: 6,
        scaleFactor: '1.5',
      },
      revision: 1,
      calculatedIngredients: [],
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'run-1', listId: 'list-1', state: 'active' },
      expect.objectContaining({
        $push: {
          recipeSelections: expect.objectContaining({
            recipeId: 'recipe-1',
            versionId: 'version-4',
            scaleFactor: '1.5',
          }),
        },
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('returns precise calculated quantities without changing recipe quantities', async () => {
    const database = databaseFor({
      currentVersion: {
        ...recipe,
        ingredients: [
          {
            originalText: '1/3 cup sugar',
            quantity: '0.3333333333333333333333333333333333333333',
            unit: 'cup',
            ingredientName: 'sugar',
            optional: false,
          },
        ],
      },
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/selections', {
        method: 'POST',
        body: JSON.stringify({ recipeId: 'recipe-1', desiredPeople: 6 }),
      }),
      routeContext(),
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      calculatedIngredients: [
        {
          sourceQuantity: '0.3333333333333333333333333333333333333333',
          calculatedQuantity: { min: '0.5' },
          suggestedShoppingQuantity: null,
        },
      ],
    })
  })

  it('rejects invalid people counts before reading list or recipe data', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/selections', {
        method: 'POST',
        body: JSON.stringify({ recipeId: 'recipe-1', desiredPeople: 0 }),
      }),
      routeContext(),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(database.lists.findOne).not.toHaveBeenCalled()
  })

  it('does not select a recipe when its immutable version is unavailable', async () => {
    const database = databaseFor({ currentVersion: null })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/selections', {
        method: 'POST',
        body: JSON.stringify({ recipeId: 'recipe-1', desiredPeople: 2 }),
      }),
      routeContext(),
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('RECIPE_VERSION_UNAVAILABLE')
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('rejects archived lists before attempting a selection', async () => {
    const database = databaseFor()
    database.lists.findOne.mockResolvedValue({ ...list, status: 'archived' })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/selections', {
        method: 'POST',
        body: JSON.stringify({ recipeId: 'recipe-1', desiredPeople: 2 }),
      }),
      routeContext(),
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('LIST_NOT_ACTIVE')
    expect(database.recipes.findOne).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/v1/lists/[listId]/selections/[selectionId]', () => {
  it('recalculates one selection from its pinned immutable version', async () => {
    const selection = {
      _id: 'selection-1',
      recipeId: 'recipe-1',
      versionId: 'version-4',
      versionNumber: 4,
      desiredPeople: 2,
      scaleFactor: '0.5',
      createdAt: '2026-09-10T12:00:00.000Z',
      updatedAt: '2026-09-10T12:00:00.000Z',
    }
    const otherSelection = { ...selection, _id: 'selection-2' }
    const database = databaseFor({
      currentRun: {
        _id: 'run-1',
        listId: 'list-1',
        state: 'active',
        revision: 4,
        recipeSelections: [selection, otherSelection],
      },
    })
    database.versions.findOne.mockResolvedValue({
      ...recipe,
      _id: 'version-4',
      ingredients: [
        {
          originalText: '2 onions',
          quantity: '2',
          unit: 'each',
          ingredientName: 'onions',
          optional: false,
        },
      ],
    })
    database.runs.findOneAndUpdate.mockResolvedValue({
      _id: 'run-1',
      revision: 5,
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      new Request(
        'http://localhost/api/v1/lists/list-1/selections/selection-1',
        {
          method: 'PATCH',
          body: JSON.stringify({ desiredPeople: 6 }),
        },
      ),
      updateRouteContext(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      selection: {
        _id: 'selection-1',
        desiredPeople: 6,
        scaleFactor: '1.5',
      },
      calculatedIngredients: [
        { calculatedQuantity: { min: '3' }, sourceQuantity: '2' },
      ],
      revision: 5,
    })
    expect(database.runs.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'run-1',
        listId: 'list-1',
        state: 'active',
        'recipeSelections._id': 'selection-1',
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          'recipeSelections.$': expect.objectContaining({
            _id: 'selection-1',
            desiredPeople: 6,
            scaleFactor: '1.5',
          }),
        }),
        $inc: { revision: 1 },
      }),
      { returnDocument: 'after' },
    )
  })

  it('rejects invalid people counts before reading the list', async () => {
    const database = databaseFor()
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      new Request(
        'http://localhost/api/v1/lists/list-1/selections/selection-1',
        {
          method: 'PATCH',
          body: JSON.stringify({ desiredPeople: 2.5 }),
        },
      ),
      updateRouteContext(),
    )

    expect(response.status).toBe(422)
    expect(database.lists.findOne).not.toHaveBeenCalled()
  })

  it('does not mutate the run when the selection is missing', async () => {
    const database = databaseFor({
      currentRun: {
        _id: 'run-1',
        listId: 'list-1',
        state: 'active',
        revision: 4,
        recipeSelections: [],
      },
    })
    getConnectedDatabase.mockResolvedValue(database.db)

    const response = await PATCH(
      new Request(
        'http://localhost/api/v1/lists/list-1/selections/selection-1',
        {
          method: 'PATCH',
          body: JSON.stringify({ desiredPeople: 6 }),
        },
      ),
      updateRouteContext(),
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('SELECTION_NOT_FOUND')
    expect(database.versions.findOne).not.toHaveBeenCalled()
    expect(database.runs.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
