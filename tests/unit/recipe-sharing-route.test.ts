import { describe, expect, it, vi } from 'vitest'
import { GET, PUT } from '@/app/api/v1/recipes/[recipeId]/shares/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const recipe = {
  _id: 'recipe-1',
  ownerId: 'user-1',
  title: 'Tomato soup',
  status: 'usable' as const,
  origin: 'authored' as const,
  visibility: 'private' as const,
  ingredients: [
    {
      originalText: '2 onions',
      ingredientName: 'onions',
      optional: false,
    },
  ],
  instructions: [],
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

function setup({
  lists = [
    {
      _id: 'list-1',
      name: 'Family',
      status: 'active' as const,
      members: [],
    },
  ],
  shares = [],
}: {
  lists?: Array<{
    _id: string
    name: string
    status: 'active' | 'archived' | 'deleted'
    members: unknown[]
  }>
  shares?: Array<{ recipeId: string; listId: string }>
} = {}) {
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
  const listCursor = { toArray: vi.fn().mockResolvedValue(lists) }
  const shareCursor = { toArray: vi.fn().mockResolvedValue(shares) }
  const collection = {
    findOne: vi.fn().mockResolvedValue(recipe),
    find: vi
      .fn()
      .mockImplementation((filter: Record<string, unknown>) =>
        'members' in filter ? listCursor : shareCursor,
      ),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    insertMany: vi.fn().mockResolvedValue({ insertedCount: 1 }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  }
  getConnectedDatabase.mockResolvedValue({
    collection: vi.fn().mockReturnValue(collection),
  })
  return collection
}

describe('PUT /api/v1/recipes/[recipeId]/shares', () => {
  it('hides sharing storage failures behind a stable retryable problem', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await PUT(
      new Request('http://localhost/api/v1/recipes/recipe-1/shares', {
        method: 'PUT',
        body: JSON.stringify({ listIds: [] }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    const body = await response.json()
    expect(body.code).toBe('RECIPE_SHARING_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('database offline')
  })

  it('rejects malformed recipe ids before querying storage', async () => {
    const collection = setup()

    const response = await PUT(
      new Request('http://localhost/api/v1/recipes/%00/shares', {
        method: 'PUT',
        body: JSON.stringify({ listIds: [] }),
      }),
      { params: Promise.resolve({ recipeId: '\u0000' }) },
    )

    expect(response.status).toBe(404)
    expect(collection.findOne).not.toHaveBeenCalled()
  })

  it('shares an authored usable recipe only with current list members', async () => {
    const collection = setup()

    const response = await PUT(
      new Request('http://localhost/api/v1/recipes/recipe-1/shares', {
        method: 'PUT',
        body: JSON.stringify({ listIds: ['list-1'] }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      visibility: 'list-shared',
      listIds: ['list-1'],
    })
    expect(collection.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        recipeId: 'recipe-1',
        listId: 'list-1',
        ownerId: 'user-1',
      }),
    ])
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'recipe-1',
        ownerId: 'user-1',
        status: { $in: ['draft', 'usable'] },
      }),
      { $set: { visibility: 'list-shared' } },
    )
  })

  it('rejects a list the recipe owner does not currently belong to', async () => {
    const collection = setup({ lists: [] })

    const response = await PUT(
      new Request('http://localhost/api/v1/recipes/recipe-1/shares', {
        method: 'PUT',
        body: JSON.stringify({ listIds: ['other-list'] }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(collection.deleteMany).not.toHaveBeenCalled()
    expect(collection.insertMany).not.toHaveBeenCalled()
    expect(collection.updateOne).not.toHaveBeenCalled()
  })

  it('can remove every share and return the recipe to private visibility', async () => {
    const collection = setup({
      shares: [{ recipeId: 'recipe-1', listId: 'list-1' }],
    })

    const response = await PUT(
      new Request('http://localhost/api/v1/recipes/recipe-1/shares', {
        method: 'PUT',
        body: JSON.stringify({ listIds: [] }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      visibility: 'private',
      listIds: [],
    })
    expect(collection.deleteMany).toHaveBeenCalledWith({
      recipeId: 'recipe-1',
      listId: { $nin: [] },
    })
  })

  it('publishes explicitly and removes list-only share relations', async () => {
    const collection = setup({
      lists: [
        {
          _id: 'list-1',
          name: 'Family',
          status: 'active',
          members: [],
        },
      ],
      shares: [{ recipeId: 'recipe-1', listId: 'list-1' }],
    })

    const response = await PUT(
      new Request('http://localhost/api/v1/recipes/recipe-1/shares', {
        method: 'PUT',
        body: JSON.stringify({ listIds: [], publishPublic: true }),
      }),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      visibility: 'public',
      listIds: [],
    })
    expect(collection.deleteMany).toHaveBeenCalledWith({
      recipeId: 'recipe-1',
      listId: { $nin: [] },
    })
  })
})

describe('GET /api/v1/recipes/[recipeId]/shares', () => {
  it('hides sharing storage failures behind a stable retryable problem', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await GET(
      new Request('http://localhost/api/v1/recipes/recipe-1/shares'),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    const body = await response.json()
    expect(body.code).toBe('RECIPE_SHARING_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('database offline')
  })

  it('rejects malformed list records without exposing persisted data', async () => {
    setup({
      lists: [
        {
          _id: 'list-1',
          name: '',
          status: 'active',
          members: [],
        },
      ],
    })

    const response = await GET(
      new Request('http://localhost/api/v1/recipes/recipe-1/shares'),
      { params: Promise.resolve({ recipeId: 'recipe-1' }) },
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('RECIPE_SHARING_UNAVAILABLE')
  })
})
