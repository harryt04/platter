import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/v1/recipes/route'

const { getSession, getConnectedDatabase, searchRecipeLibrary } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    getConnectedDatabase: vi.fn(),
    searchRecipeLibrary: vi.fn(),
  }),
)

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/recipes/library', async () => {
  const actual = await vi.importActual<typeof import('@/lib/recipes/library')>(
    '@/lib/recipes/library',
  )
  return {
    ...actual,
    decodeRecipeLibraryCursor: vi.fn(() => ({
      updatedAt: '2026-09-10T12:00:00.000Z',
      id: 'recipe-1',
    })),
    searchRecipeLibrary,
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

function validRecipe(id: string, title: string) {
  return {
    id,
    recipeId: id,
    versionId: `${id}-version`,
    versionNumber: 1,
    ownerId: 'user-1',
    title,
    status: 'draft',
    origin: 'authored',
    importReviewStatus: 'not-required',
    visibility: 'private',
    ingredients: [],
    instructions: [],
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  }
}

describe('GET /api/v1/recipes', () => {
  it('returns owned and shared library entries with their access labels', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockResolvedValue({})
    searchRecipeLibrary.mockResolvedValue({
      entries: [
        {
          recipe: validRecipe('recipe-1', 'Private recipe'),
          access: 'owned',
          sharedListNames: [],
        },
        {
          recipe: validRecipe('recipe-2', 'Shared recipe'),
          access: 'shared',
          sharedListNames: ['Family'],
        },
      ],
      nextCursor: 'next-cursor',
    })

    const response = await GET(
      new Request('http://localhost/api/v1/recipes?q=onion&pageSize=10'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      recipes: [
        {
          ...validRecipe('recipe-1', 'Private recipe'),
          libraryAccess: 'owned',
        },
        {
          ...validRecipe('recipe-2', 'Shared recipe'),
          libraryAccess: 'shared',
          sharedListNames: ['Family'],
        },
      ],
      nextCursor: 'next-cursor',
    })
    expect(searchRecipeLibrary).toHaveBeenCalledWith({}, 'user-1', {
      text: 'onion',
      cursor: undefined,
      pageSize: 10,
    })
  })

  it('hides storage failures behind a stable retryable problem', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await GET(new Request('http://localhost/api/v1/recipes'))

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect((await response.json()).code).toBe('RECIPE_LIBRARY_UNAVAILABLE')
  })

  it('hides authentication-service failures behind a stable retryable problem', async () => {
    getSession.mockRejectedValue(new Error('auth service offline'))

    const response = await GET(new Request('http://localhost/api/v1/recipes'))

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('RECIPE_LIBRARY_UNAVAILABLE')
  })

  it('rejects malformed library entries without exposing persisted data', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockResolvedValue({})
    searchRecipeLibrary.mockResolvedValue({
      entries: [
        {
          recipe: { id: 'recipe-1', title: 'Only part of a recipe' },
          access: 'owned',
          sharedListNames: [],
        },
      ],
    })

    const response = await GET(new Request('http://localhost/api/v1/recipes'))

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('RECIPE_LIBRARY_UNAVAILABLE')
  })
})

describe('POST /api/v1/recipes', () => {
  it('returns a validated title-only draft envelope', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const collection = {
      insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/recipes', {
        method: 'POST',
        body: JSON.stringify({ title: '  Tomato soup  ' }),
      }),
    )

    expect(response.status).toBe(201)
    expect((await response.json()).recipe).toMatchObject({
      title: 'Tomato soup',
      status: 'draft',
      origin: 'authored',
      visibility: 'private',
    })
    expect(collection.insertOne).toHaveBeenCalledTimes(2)
  })

  it('hides recipe draft persistence failures behind a stable problem', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await POST(
      new Request('http://localhost/api/v1/recipes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Tomato soup' }),
      }),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('RECIPE_CREATION_FAILED')
  })

  it('hides authentication-service failures behind a stable retryable problem', async () => {
    getSession.mockRejectedValue(new Error('auth service offline'))

    const response = await POST(
      new Request('http://localhost/api/v1/recipes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Tomato soup' }),
      }),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('RECIPE_CREATION_FAILED')
  })
})
