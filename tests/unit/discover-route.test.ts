import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/discover/recipes/route'

const { decodeCursor, getConnectedDatabase, searchRecipes } = vi.hoisted(
  () => ({
    decodeCursor: vi.fn((value: string) =>
      value === 'valid-cursor' ? { rankScore: 2, id: 'recipe-1' } : null,
    ),
    getConnectedDatabase: vi.fn(),
    searchRecipes: vi.fn(),
  }),
)

vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/search/mongo-provider', () => ({
  decodeRecipeSearchCursor: decodeCursor,
}))
vi.mock('@/lib/search/default-provider', () => ({
  createRecipeSearchProvider: vi.fn(() => ({ searchRecipes })),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/v1/discover/recipes', () => {
  it('searches public recipes without requiring a session', async () => {
    getConnectedDatabase.mockResolvedValue({})
    searchRecipes.mockResolvedValue({
      results: [{ id: 'recipe-1', title: 'Soup', visibility: 'public' }],
    })

    const response = await GET(
      new Request(
        'http://localhost/api/v1/discover/recipes?q=onions&cuisine=Italian&tags=weeknight,quick&dietaryLabels=vegetarian',
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      results: [{ id: 'recipe-1', title: 'Soup', visibility: 'public' }],
    })
    expect(searchRecipes).toHaveBeenCalledWith({
      text: 'onions',
      pageSize: 20,
      filters: {
        cuisine: 'Italian',
        tags: ['weeknight', 'quick'],
        dietaryLabels: ['vegetarian'],
      },
    })
  })

  it('passes composed filters and a valid cursor to the provider', async () => {
    getConnectedDatabase.mockResolvedValue({})
    searchRecipes.mockResolvedValue({ results: [] })

    const response = await GET(
      new Request(
        'http://localhost/api/v1/discover/recipes?cuisine=Mexican&tags=quick,weeknight&dietaryLabels=vegetarian&cursor=valid-cursor&pageSize=5',
      ),
    )

    expect(response.status).toBe(200)
    expect(searchRecipes).toHaveBeenCalledWith({
      text: '',
      cursor: 'valid-cursor',
      pageSize: 5,
      filters: {
        cuisine: 'Mexican',
        tags: ['quick', 'weeknight'],
        dietaryLabels: ['vegetarian'],
      },
    })
  })

  it('rejects malformed pagination cursors', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/discover/recipes?cursor=not-valid'),
    )

    expect(response.status).toBe(422)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('rejects oversized search terms', async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/v1/discover/recipes?q=${'x'.repeat(101)}`,
      ),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })
})
