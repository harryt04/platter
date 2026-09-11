import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/admin/public-content-suppressions/route'

const { getSession, getConnectedDatabase, getMongoClient } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
  getMongoClient: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({
  getConnectedDatabase,
  getMongoClient,
}))

function setup({ recipe = true, activeSuppression = false } = {}) {
  const insertedSuppressions: unknown[] = []
  const insertedAudits: unknown[] = []
  const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
  const updateMany = vi.fn().mockResolvedValue({ matchedCount: 1 })
  const suppressionCollection = {
    findOne: vi.fn().mockResolvedValue(activeSuppression ? {} : null),
    insertOne: vi.fn((document: unknown) => {
      insertedSuppressions.push(document)
      return Promise.resolve()
    }),
  }
  const auditCollection = {
    insertOne: vi.fn((document: unknown) => {
      insertedAudits.push(document)
      return Promise.resolve()
    }),
  }
  const recipeCollection = {
    findOne: vi.fn().mockResolvedValue(recipe ? { _id: 'recipe-1' } : null),
    updateOne,
    updateMany,
  }
  const collections = new Map<string, unknown>([
    ['public_content_suppressions', suppressionCollection],
    ['public_content_suppression_audit', auditCollection],
    ['recipes', recipeCollection],
  ])
  const db = {
    collection: vi.fn((name: string) => collections.get(name)),
  }
  const transactionSession = {}
  getConnectedDatabase.mockResolvedValue(db)
  getMongoClient.mockReturnValue({
    withSession: vi.fn(async (callback: (session: unknown) => unknown) =>
      callback({
        withTransaction: (transaction: (session: unknown) => unknown) =>
          transaction(transactionSession),
      }),
    ),
  })
  return {
    auditCollection,
    db,
    insertedAudits,
    insertedSuppressions,
    recipeCollection,
    suppressionCollection,
    updateOne,
    updateMany,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
})

describe('POST /api/v1/admin/public-content-suppressions', () => {
  it('records an audited recipe suppression and hides the recipe atomically', async () => {
    const setupResult = setup()
    const response = await POST(
      new Request('http://localhost/api/v1/admin/public-content-suppressions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetType: 'recipe',
          target: 'recipe-1',
          reason: 'Rights holder requested removal.',
        }),
      }),
    )

    expect(response.status).toBe(201)
    const result = await response.json()
    expect(result.suppression).toMatchObject({
      targetType: 'recipe',
      target: 'recipe-1',
      reason: 'Rights holder requested removal.',
      status: 'active',
      createdBy: 'admin-1',
    })
    expect(result.suppression.auditId).toBe(
      setupResult.insertedAudits[0] &&
        (setupResult.insertedAudits[0] as { _id: string })._id,
    )
    expect(setupResult.insertedSuppressions).toHaveLength(1)
    expect(setupResult.insertedAudits).toHaveLength(1)
    expect(setupResult.updateOne).toHaveBeenCalledWith(
      { _id: 'recipe-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ visibility: 'suppressed' }),
      }),
      expect.objectContaining({ session: expect.anything() }),
    )
  })

  it('normalizes URL and domain targets while retaining the reason and audit actor', async () => {
    const urlSetup = setup({ recipe: false })
    const urlResponse = await POST(
      new Request('http://localhost/api/v1/admin/public-content-suppressions', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'source-url',
          target: 'https://Example.com/recipe#section',
          reason: 'Source removal request',
        }),
      }),
    )
    expect(urlResponse.status).toBe(201)
    expect(urlSetup.insertedSuppressions[0]).toMatchObject({
      targetType: 'source-url',
      target: 'https://example.com/recipe',
      createdBy: 'admin-1',
    })
    expect(urlSetup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'usable',
        visibility: 'public',
        $or: expect.arrayContaining([
          expect.objectContaining({ sourceUrl: expect.anything() }),
        ]),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ visibility: 'suppressed' }),
      }),
      expect.objectContaining({ session: expect.anything() }),
    )

    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    const domainSetup = setup({ recipe: false })
    const domainResponse = await POST(
      new Request('http://localhost/api/v1/admin/public-content-suppressions', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'domain',
          target: 'WWW.Example.COM',
          reason: 'Repeat source complaints.',
        }),
      }),
    )
    expect(domainResponse.status).toBe(201)
    expect(domainSetup.insertedSuppressions[0]).toMatchObject({
      targetType: 'domain',
      target: 'example.com',
    })
    expect(domainSetup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'usable',
        visibility: 'public',
        $or: expect.arrayContaining([
          expect.objectContaining({
            'importProvenance.sourceDomain': 'example.com',
          }),
        ]),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ visibility: 'suppressed' }),
      }),
      expect.objectContaining({ session: expect.anything() }),
    )
  })

  it('rejects unauthenticated, non-admin, invalid, missing, and duplicate requests', async () => {
    getSession.mockResolvedValueOnce(null)
    expect(
      (
        await POST(
          new Request(
            'http://localhost/api/v1/admin/public-content-suppressions',
            {
              method: 'POST',
            },
          ),
        )
      ).status,
    ).toBe(401)

    getSession.mockResolvedValueOnce({ user: { id: 'user-1', role: 'user' } })
    expect(
      (
        await POST(
          new Request(
            'http://localhost/api/v1/admin/public-content-suppressions',
            {
              method: 'POST',
            },
          ),
        )
      ).status,
    ).toBe(403)

    getSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'admin' } })
    expect(
      (
        await POST(
          new Request(
            'http://localhost/api/v1/admin/public-content-suppressions',
            {
              method: 'POST',
              body: JSON.stringify({
                targetType: 'source-url',
                target: 'file:///private',
                reason: 'x',
              }),
            },
          ),
        )
      ).status,
    ).toBe(422)

    getSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'admin' } })
    setup({ recipe: false })
    expect(
      (
        await POST(
          new Request(
            'http://localhost/api/v1/admin/public-content-suppressions',
            {
              method: 'POST',
              body: JSON.stringify({
                targetType: 'recipe',
                target: 'missing',
                reason: 'x',
              }),
            },
          ),
        )
      ).status,
    ).toBe(404)

    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    setup({ activeSuppression: true })
    expect(
      (
        await POST(
          new Request(
            'http://localhost/api/v1/admin/public-content-suppressions',
            {
              method: 'POST',
              body: JSON.stringify({
                targetType: 'domain',
                target: 'example.com',
                reason: 'x',
              }),
            },
          ),
        )
      ).status,
    ).toBe(409)
  })
})
