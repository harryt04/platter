import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, POST } from '@/app/api/v1/recipes/[recipeId]/save/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const publicRecipe = {
  _id: 'recipe-1',
  ownerId: 'owner-1',
  title: 'Tomato soup',
  status: 'usable' as const,
  visibility: 'public' as const,
  origin: 'authored' as 'authored' | 'imported',
  importReviewStatus: 'not-required' as
    'not-required' | 'pending' | 'approved' | 'rejected',
  ingredients: [],
  instructions: [],
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

function setup(recipe: typeof publicRecipe | null = publicRecipe) {
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
  const collection = {
    findOne: vi.fn().mockResolvedValue(recipe),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  }
  const databaseCollection = vi.fn().mockReturnValue(collection)
  getConnectedDatabase.mockResolvedValue({
    collection: databaseCollection,
  })
  return { collection, databaseCollection }
}

beforeEach(() => vi.clearAllMocks())

describe('/api/v1/recipes/[recipeId]/save', () => {
  it('rejects malformed recipe ids before querying storage', async () => {
    const { databaseCollection } = setup()

    const response = await POST(
      new Request('http://localhost/api/v1/recipes/%00/save', {
        method: 'POST',
      }),
      { params: Promise.resolve({ recipeId: '\u0000' }) },
    )

    expect(response.status).toBe(404)
    expect(databaseCollection).not.toHaveBeenCalled()
  })

  it('requires authentication to save or remove a recipe', async () => {
    getSession.mockResolvedValue(null)

    const saveResponse = await POST(
      new Request('http://localhost/api/v1/recipes/recipe-1/save', {
        method: 'POST',
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )
    const removeResponse = await DELETE(
      new Request('http://localhost/api/v1/recipes/recipe-1/save', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(saveResponse.status).toBe(401)
    expect(removeResponse.status).toBe(401)
  })

  it('saves only a public recipe and is idempotent for the same user', async () => {
    const { collection, databaseCollection } = setup()

    const first = await POST(
      new Request('http://localhost/api/v1/recipes/recipe-1/save', {
        method: 'POST',
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )
    const second = await POST(
      new Request('http://localhost/api/v1/recipes/recipe-1/save', {
        method: 'POST',
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await first.json()).toEqual({ recipeId: 'recipe-1', saved: true })
    expect(collection.updateOne).toHaveBeenCalledWith(
      { userId: 'user-1', recipeId: 'recipe-1' },
      {
        $setOnInsert: expect.objectContaining({
          userId: 'user-1',
          recipeId: 'recipe-1',
        }),
      },
      { upsert: true },
    )
    expect(databaseCollection).not.toHaveBeenCalledWith('shopping_runs')
  })

  it('rejects a recipe that is no longer publicly available', async () => {
    const { collection } = setup(null)

    const response = await POST(
      new Request('http://localhost/api/v1/recipes/recipe-1/save', {
        method: 'POST',
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(404)
    expect(collection.updateOne).not.toHaveBeenCalled()
  })

  it('removes only the current user’s saved reference', async () => {
    const { collection } = setup()

    const response = await DELETE(
      new Request('http://localhost/api/v1/recipes/recipe-1/save', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      recipeId: 'recipe-1',
      saved: false,
    })
    expect(collection.deleteOne).toHaveBeenCalledWith({
      userId: 'user-1',
      recipeId: 'recipe-1',
    })
  })

  it('hides malformed public recipe targets behind a retryable problem', async () => {
    const { collection } = setup({
      ...publicRecipe,
      status: 'usable',
      visibility: 'public',
      origin: 'imported',
      importReviewStatus: 'pending',
    })

    const response = await POST(
      new Request('http://localhost/api/v1/recipes/recipe-1/save', {
        method: 'POST',
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(await response.json()).toEqual({
      type: 'https://platter.dev/problems/recipe-save-unavailable',
      title: 'Recipe save temporarily unavailable',
      status: 503,
      detail:
        'That saved recipe action could not be completed. Try again shortly.',
      code: 'RECIPE_SAVE_UNAVAILABLE',
    })
    expect(collection.updateOne).not.toHaveBeenCalled()
  })

  it('hides storage failures for save and remove behind a retryable problem', async () => {
    const { collection } = setup()
    collection.findOne.mockRejectedValueOnce(new Error('database unavailable'))

    const saveResponse = await POST(
      new Request('http://localhost/api/v1/recipes/recipe-1/save', {
        method: 'POST',
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    collection.deleteOne.mockRejectedValueOnce(
      new Error('database unavailable'),
    )
    const removeResponse = await DELETE(
      new Request('http://localhost/api/v1/recipes/recipe-1/save', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(saveResponse.status).toBe(503)
    expect(removeResponse.status).toBe(503)
    expect(await saveResponse.json()).toMatchObject({
      code: 'RECIPE_SAVE_UNAVAILABLE',
    })
    expect(await removeResponse.json()).toMatchObject({
      code: 'RECIPE_SAVE_UNAVAILABLE',
    })
  })
})
