import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/complaints/route'
import { resetRateLimitsForTests } from '@/lib/security/rate-limit'

const { getConnectedDatabase } = vi.hoisted(() => ({
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const publicRecipe = { _id: 'public-recipe-1' }

function setup() {
  const collection = {
    findOne: vi.fn().mockResolvedValue(publicRecipe),
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  getConnectedDatabase.mockResolvedValue({
    collection: vi.fn().mockReturnValue(collection),
  })
  return collection
}

function request(body: unknown, ip = '198.51.100.10') {
  return new Request('http://localhost/api/v1/complaints', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimitsForTests()
})

describe('POST /api/v1/complaints', () => {
  it('creates a restricted complaint and returns only a receipt', async () => {
    const collection = setup()
    const response = await POST(
      request({
        type: 'copyright',
        recipeId: 'public-recipe-1',
        description: 'This recipe uses my published work.',
        contactName: 'Recipe owner',
        contactEmail: 'OWNER@EXAMPLE.COM',
      }),
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.complaint).toMatchObject({
      id: expect.any(String),
      status: 'received',
      receivedAt: expect.any(String),
    })
    expect(body.complaint).not.toHaveProperty('contact')
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        recipeId: 'public-recipe-1',
        type: 'copyright',
        status: 'received',
        description: 'This recipe uses my published work.',
        contact: { name: 'Recipe owner', email: 'owner@example.com' },
        statusHistory: [
          expect.objectContaining({
            status: 'received',
            actorType: 'public-submission',
          }),
        ],
      }),
    )
  })

  it('accepts a source-only report without exposing contact data', async () => {
    const collection = setup()
    const response = await POST(
      request({
        type: 'source-removal',
        sourceUrl: ' https://example.com/recipe ',
        description: 'Please review this source.',
      }),
    )

    expect(response.status).toBe(201)
    expect(collection.findOne).not.toHaveBeenCalled()
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceUrl: 'https://example.com/recipe',
      }),
    )
  })

  it('rejects invalid reports before persistence', async () => {
    const collection = setup()
    const response = await POST(
      request({ type: 'copyright', description: 'Missing target.' }),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).fields.recipeId).toContain(
      'Enter a public recipe id or source URL to review.',
    )
    expect(collection.insertOne).not.toHaveBeenCalled()
  })

  it('does not accept private or missing recipe targets', async () => {
    const collection = setup()
    collection.findOne.mockResolvedValue(null)
    const response = await POST(
      request({
        type: 'other',
        recipeId: 'private-recipe-1',
        description: 'Please review this recipe.',
      }),
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('RECIPE_NOT_FOUND')
    expect(collection.insertOne).not.toHaveBeenCalled()
  })

  it('hides database failures behind a retryable problem response', async () => {
    const collection = setup()
    collection.findOne.mockRejectedValueOnce(new Error('database unavailable'))

    const response = await POST(
      request({
        type: 'other',
        recipeId: 'public-recipe-1',
        description: 'Please review this recipe.',
      }),
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    const body = await response.json()
    expect(body).toMatchObject({
      code: 'COMPLAINT_SUBMISSION_UNAVAILABLE',
      status: 503,
    })
    expect(JSON.stringify(body)).not.toContain('database unavailable')

    getConnectedDatabase.mockRejectedValueOnce(new Error('mongo unavailable'))
    const unavailable = await POST(
      request(
        {
          type: 'other',
          sourceUrl: 'https://example.com/recipe',
          description: 'Please review this source.',
        },
        '198.51.100.11',
      ),
    )
    expect(unavailable.status).toBe(503)
    expect(JSON.stringify(await unavailable.json())).not.toContain(
      'mongo unavailable',
    )
  })

  it('hides complaint persistence failures without exposing the receipt', async () => {
    const collection = setup()
    collection.insertOne.mockRejectedValueOnce(new Error('write unavailable'))

    const response = await POST(
      request({
        type: 'source-removal',
        sourceUrl: 'https://example.com/recipe',
        description: 'Please review this source.',
      }),
    )

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.complaint).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('write unavailable')
  })

  it('rate-limits public submissions by client address', async () => {
    const collection = setup()
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        POST(
          request(
            {
              type: 'other',
              sourceUrl: `https://example.com/recipe-${index}`,
              description: 'Please review this source.',
            },
            '203.0.113.7',
          ),
        ),
      ),
    )

    expect(responses.slice(0, 5).every((item) => item.status === 201)).toBe(
      true,
    )
    expect(responses[5]?.status).toBe(429)
    expect(responses[5]?.headers.get('retry-after')).toMatch(/^\d+$/)
    expect(collection.insertOne).toHaveBeenCalledTimes(5)
  })
})
