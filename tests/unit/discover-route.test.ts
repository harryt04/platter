import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/discover/recipes/route'
import { resetRateLimitsForTests } from '@/lib/security/rate-limit'

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
  resetRateLimitsForTests()
})

describe('GET /api/v1/discover/recipes', () => {
  it('searches public recipes without requiring a session', async () => {
    getConnectedDatabase.mockResolvedValue({})
    searchRecipes.mockResolvedValue({
      results: [
        {
          id: 'recipe-1',
          title: 'Soup',
          source: 'Platter community',
          score: '1',
          visibility: 'public',
        },
      ],
    })

    const response = await GET(
      new Request(
        'http://localhost/api/v1/discover/recipes?q=onions&cuisine=Italian&tags=weeknight,quick&dietaryLabels=vegetarian',
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      results: [
        {
          id: 'recipe-1',
          title: 'Soup',
          source: 'Platter community',
          score: '1',
          visibility: 'public',
        },
      ],
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

  it('rate-limits public searches by client address with a retryable problem', async () => {
    getConnectedDatabase.mockResolvedValue({})
    searchRecipes.mockResolvedValue({ results: [] })
    const requests = Array.from({ length: 121 }, () =>
      GET(
        new Request('http://localhost/api/v1/discover/recipes?q=soup', {
          headers: { 'x-forwarded-for': '203.0.113.8' },
        }),
      ),
    )

    const responses = await Promise.all(requests)
    const limited = responses.at(-1)

    expect(
      responses.slice(0, 120).every((response) => response.status === 200),
    ).toBe(true)
    expect(limited?.status).toBe(429)
    expect(limited?.headers.get('retry-after')).toMatch(/^\d+$/)
    expect((await limited?.json()).code).toBe('RATE_LIMITED')
    expect(searchRecipes).toHaveBeenCalledTimes(120)
  })

  it('returns a stable problem when the provider returns an invalid response', async () => {
    getConnectedDatabase.mockResolvedValue({})
    searchRecipes.mockResolvedValue({
      results: [{ id: 'recipe-1', title: 'Soup', visibility: 'public' }],
    })

    const response = await GET(
      new Request('http://localhost/api/v1/discover/recipes?q=soup'),
    )

    expect(response.status).toBe(502)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(await response.json()).toEqual({
      type: 'https://platter.dev/problems/search-response-invalid',
      title: 'Search unavailable',
      status: 502,
      detail: 'The public recipe search returned an invalid response.',
      code: 'SEARCH_RESPONSE_INVALID',
    })
  })
})
