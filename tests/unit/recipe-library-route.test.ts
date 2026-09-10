import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/recipes/route'

const { getSession, getConnectedDatabase, findRecipeLibrary } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    getConnectedDatabase: vi.fn(),
    findRecipeLibrary: vi.fn(),
  }),
)

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/recipes/library', () => ({ findRecipeLibrary }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/v1/recipes', () => {
  it('returns owned and shared library entries with their access labels', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockResolvedValue({})
    findRecipeLibrary.mockResolvedValue([
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
    ])

    const response = await GET()

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
    })
    expect(findRecipeLibrary).toHaveBeenCalledWith({}, 'user-1')
  })
})
