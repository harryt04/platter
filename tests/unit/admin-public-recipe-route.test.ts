import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/admin/public-recipes/route'
import { isoDateTime } from '@/lib/contracts/ids'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const recipe: RecipeDraftDocument = {
  _id: 'recipe-1',
  ownerId: 'owner-1',
  title: 'Synthetic soup',
  status: 'usable',
  visibility: 'public',
  origin: 'imported',
  importReviewStatus: 'approved',
  sourceName: 'Synthetic kitchen',
  sourceUrl: 'https://example.com/soup',
  sourceAuthor: 'A. Cook',
  updatedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
  createdAt: isoDateTime('2026-09-09T12:00:00.000Z'),
  ingredients: [],
  instructions: [],
  importProvenance: {
    submittedUrl: 'https://example.com/soup',
    canonicalUrl: 'https://example.com/soup',
    sourceDomain: 'example.com',
    importer: 'schema-org-json-ld',
    importedAt: isoDateTime('2026-09-10T11:00:00.000Z'),
    acquiredAt: isoDateTime('2026-09-10T11:00:00.000Z'),
    acquisitionMethod: 'server-fetch',
    contentFingerprint: 'sha256:abc',
    versionRelationship: 'source-original',
    rightsStatus: 'unknown',
  },
}

function setup() {
  const cursor = {
    project: vi.fn(() => cursor),
    sort: vi.fn(() => cursor),
    limit: vi.fn(() => cursor),
    toArray: vi.fn().mockResolvedValue([recipe]),
  }
  const collection = {
    find: vi.fn((filter: unknown) => {
      void filter
      return cursor
    }),
  }
  getConnectedDatabase.mockResolvedValue({
    collection: vi.fn().mockReturnValue(collection),
  })
  return { collection, cursor }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
})

describe('GET /api/v1/admin/public-recipes', () => {
  it('finds public content by each supported metadata field', async () => {
    const { collection, cursor } = setup()

    const response = await GET(
      new Request(
        'http://localhost/api/v1/admin/public-recipes?field=fingerprint&q=sha256%3Aabc&limit=10',
      ),
    )

    expect(response.status).toBe(200)
    const result = (await response.json()).recipes[0]
    expect(result).toMatchObject({
      id: 'recipe-1',
      title: 'Synthetic soup',
      importer: 'schema-org-json-ld',
      contentFingerprint: 'sha256:abc',
      rightsStatus: 'unknown',
    })
    expect(result).not.toHaveProperty('ingredients')
    expect(collection.find).toHaveBeenCalledWith({
      $and: [
        { status: 'usable', visibility: { $in: ['public', 'suppressed'] } },
        { 'importProvenance.contentFingerprint': 'sha256:abc' },
      ],
    })
    expect(cursor.limit).toHaveBeenCalledWith(10)
  })

  it('normalizes domain searches and keeps regex input literal', async () => {
    const { collection } = setup()

    const response = await GET(
      new Request(
        'http://localhost/api/v1/admin/public-recipes?field=domain&q=WWW.Example.COM',
      ),
    )

    expect(response.status).toBe(200)
    const filter = collection.find.mock.calls[0]?.[0]
    expect(filter).toBeDefined()
    const typedFilter = filter as unknown as {
      $and: Array<{ $or?: unknown[] }>
    }
    expect(typedFilter.$and[1]?.$or?.[0]).toEqual({
      'importProvenance.sourceDomain': 'example.com',
    })
    expect(typedFilter.$and[1]?.$or?.[1]).toEqual({
      sourceUrl: {
        $regex: '(?:^|://)(?:www\\.)?example\\.com(?:/|$)',
        $options: 'i',
      },
    })
  })

  it('rejects unauthenticated, non-admin, and malformed searches', async () => {
    getSession.mockResolvedValueOnce(null)
    expect(
      (await GET(new Request('http://localhost/api/v1/admin/public-recipes')))
        .status,
    ).toBe(401)

    getSession.mockResolvedValueOnce({ user: { id: 'user-1', role: 'user' } })
    expect(
      (await GET(new Request('http://localhost/api/v1/admin/public-recipes')))
        .status,
    ).toBe(403)

    getSession.mockResolvedValueOnce({
      user: { id: 'admin-1', role: 'admin' },
    })
    expect(
      (
        await GET(
          new Request(
            `http://localhost/api/v1/admin/public-recipes?field=unknown&q=${'x'.repeat(2049)}`,
          ),
        )
      ).status,
    ).toBe(422)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })
})
