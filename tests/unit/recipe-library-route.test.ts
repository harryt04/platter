import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/recipes/route'

const { getSession, getConnectedDatabase, searchRecipeLibrary } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    getConnectedDatabase: vi.fn(),
    searchRecipeLibrary: vi.fn(),
  }),
)

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/recipes/library', () => ({
  decodeRecipeLibraryCursor: vi.fn(() => ({
    updatedAt: '2026-09-10T12:00:00.000Z',
    id: 'recipe-1',
  })),
  searchRecipeLibrary,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/v1/recipes', () => {
  it('returns owned and shared library entries with their access labels', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockResolvedValue({})
    searchRecipeLibrary.mockResolvedValue({
      entries: [
        {
          recipe: { id: 'recipe-1', title: 'Private recipe' },
          access: 'owned',
          sharedListNames: [],
        },
        {
          recipe: { id: 'recipe-2', title: 'Shared recipe' },
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
          id: 'recipe-1',
          title: 'Private recipe',
          libraryAccess: 'owned',
        },
        {
          id: 'recipe-2',
          title: 'Shared recipe',
          libraryAccess: 'shared',
          sharedListNames: ['Family'],
        },
      ],
      nextCursor: 'next-cursor',
    })
    expect(searchRecipeLibrary).toHaveBeenCalledWith({}, 'user-1', {
      q: 'onion',
      cursor: undefined,
      pageSize: 10,
    })
  })
})
