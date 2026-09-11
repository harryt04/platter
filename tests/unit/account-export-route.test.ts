import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET as download } from '@/app/api/v1/account/exports/[exportId]/route'
import { POST } from '@/app/api/v1/account/exports/route'

const { getSession, getConnectedDatabase, createAccountExport } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    getConnectedDatabase: vi.fn(),
    createAccountExport: vi.fn(),
  }),
)

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/account-exports', async () => {
  const actual = await vi.importActual<typeof import('@/lib/account-exports')>(
    '@/lib/account-exports',
  )
  return { ...actual, createAccountExport }
})

afterEach(() => vi.clearAllMocks())

const user = {
  id: 'user-1',
  name: 'Jamie',
  email: 'jamie@example.test',
  locale: 'en-US',
}
const document = {
  _id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-1',
  status: 'ready' as const,
  payload: {
    format: 'platter-account-export' as const,
    version: 1 as const,
    generatedAt: '2026-09-10T00:00:00.000Z' as never,
    account: user,
    memberships: [],
    recipes: [],
    savedRecipes: [],
    imports: [],
    history: [],
  },
  createdAt: '2026-09-10T00:00:00.000Z' as never,
  expiresAt: '2026-09-12T00:00:00.000Z' as never,
}

describe('account export routes', () => {
  it('requires authentication before creating an export', async () => {
    getSession.mockResolvedValue(null)

    const response = await POST()

    expect(response.status).toBe(401)
    expect(createAccountExport).not.toHaveBeenCalled()
  })

  it('requires authentication before downloading an export', async () => {
    getSession.mockResolvedValue(null)

    const response = await download(new Request('http://localhost'), {
      params: Promise.resolve({ exportId: document._id }),
    })

    expect(response.status).toBe(401)
  })

  it('creates an owner-scoped export and returns an opaque download URL', async () => {
    getSession.mockResolvedValue({ user })
    createAccountExport.mockResolvedValue(document)
    const insertOne = vi.fn()
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue({ insertOne }),
    })

    const response = await POST()

    expect(response.status).toBe(201)
    expect(insertOne).toHaveBeenCalledWith(document)
    expect(await response.json()).toMatchObject({
      export: {
        id: document._id,
        status: 'ready',
        downloadUrl: `/api/v1/account/exports/${document._id}`,
      },
    })
  })

  it('downloads only the signed-in user’s unexpired export', async () => {
    getSession.mockResolvedValue({ user })
    const findOne = vi.fn().mockResolvedValue(document)
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue({ findOne }),
    })

    const response = await download(new Request('http://localhost'), {
      params: Promise.resolve({ exportId: document._id }),
    })

    expect(response.status).toBe(200)
    expect(findOne).toHaveBeenCalledWith({ _id: document._id, userId: user.id })
    expect(response.headers.get('cache-control')).toBe('no-store, private')
    expect(response.headers.get('content-disposition')).toContain(
      'platter-account-export.json',
    )
    expect(await response.json()).toEqual(document.payload)
  })

  it('hides malformed, expired, and cross-account export IDs', async () => {
    getSession.mockResolvedValue({ user })
    const findOne = vi.fn().mockResolvedValue({ ...document, userId: 'user-2' })
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue({ findOne }),
    })

    const malformed = await download(new Request('http://localhost'), {
      params: Promise.resolve({ exportId: 'not-an-id' }),
    })
    expect(malformed.status).toBe(404)
    expect(findOne).not.toHaveBeenCalled()

    const missing = await download(new Request('http://localhost'), {
      params: Promise.resolve({ exportId: document._id }),
    })
    expect(missing.status).toBe(404)
  })

  it('hides storage failures and malformed export documents behind a retryable problem', async () => {
    getSession.mockResolvedValue({ user })
    const findOne = vi.fn().mockResolvedValue({
      ...document,
      payload: { ...document.payload, account: { email: 'not-an-email' } },
    })
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue({ findOne }),
    })

    const malformed = await download(new Request('http://localhost'), {
      params: Promise.resolve({ exportId: document._id }),
    })
    expect(malformed.status).toBe(503)
    expect(malformed.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(await malformed.json()).toEqual({
      type: 'https://platter.dev/problems/account-export-unavailable',
      title: 'Export temporarily unavailable',
      status: 503,
      detail: 'That export could not be loaded. Try again shortly.',
      code: 'ACCOUNT_EXPORT_UNAVAILABLE',
    })

    getConnectedDatabase.mockRejectedValue(new Error('database credentials'))
    const unavailable = await download(new Request('http://localhost'), {
      params: Promise.resolve({ exportId: document._id }),
    })
    expect(unavailable.status).toBe(503)
    expect(await unavailable.text()).not.toContain('database credentials')
  })
})
