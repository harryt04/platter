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
  origin: 'authored' as const,
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
})
