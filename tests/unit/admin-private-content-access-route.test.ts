import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/admin/private-content-access/route'

const { getSession, serverEnv, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  serverEnv: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/env/server', () => ({ serverEnv }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

function request(body: unknown) {
  return new Request('http://localhost/api/v1/admin/private-content-access', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  serverEnv.mockReturnValue({ ADMIN_PRIVATE_CONTENT_ACCESS_ENABLED: false })
  getConnectedDatabase.mockResolvedValue({
    collection: () => ({ insertOne: vi.fn().mockResolvedValue(undefined) }),
  })
})

describe('POST /api/v1/admin/private-content-access', () => {
  it('rejects anonymous, non-admin, and disabled access requests', async () => {
    getSession.mockResolvedValueOnce(null)
    expect((await POST(request({}))).status).toBe(401)

    getSession.mockResolvedValueOnce({ user: { id: 'user-1', role: 'user' } })
    expect((await POST(request({}))).status).toBe(403)

    getSession.mockResolvedValueOnce({
      user: { id: 'admin-1', role: 'admin' },
    })
    expect(
      (
        await POST(
          request({
            targetUserId: 'user-private-1',
            purpose: 'support-case',
            caseReference: 'SUP-1234',
          }),
        )
      ).status,
    ).toBe(403)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('returns a time-limited scoped grant and writes a metadata-only audit', async () => {
    serverEnv.mockReturnValue({ ADMIN_PRIVATE_CONTENT_ACCESS_ENABLED: true })
    getSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    const insertOne = vi.fn().mockResolvedValue(undefined)
    getConnectedDatabase.mockResolvedValue({
      collection: () => ({ insertOne }),
    })

    const response = await POST(
      request({
        targetUserId: 'user-private-1',
        purpose: 'legal-request',
        caseReference: 'LEGAL/42',
      }),
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.access).toMatchObject({
      purpose: 'legal-request',
      caseReference: 'LEGAL/42',
      scope: 'private-user-content',
    })
    expect(new Date(body.access.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    )
    expect(body.access.expiresAt).not.toBe(body.access.grantedAt)
    expect(body.access).not.toHaveProperty('targetUserId')
    expect(insertOne).toHaveBeenCalledOnce()
    expect(insertOne.mock.calls[0][0]).not.toHaveProperty('targetUserId')
  })

  it('hides audit storage failures behind a stable retryable problem', async () => {
    serverEnv.mockReturnValue({ ADMIN_PRIVATE_CONTENT_ACCESS_ENABLED: true })
    getSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    getConnectedDatabase.mockResolvedValue({
      collection: () => ({
        insertOne: vi
          .fn()
          .mockRejectedValue(new Error('private backend detail')),
      }),
    })

    const response = await POST(
      request({
        targetUserId: 'user-private-1',
        purpose: 'security-incident',
        caseReference: 'SEC-42',
      }),
    )
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain(
      'private backend detail',
    )
  })
})
