import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/account/delete/route'

const {
  getSession,
  getConnectedDatabase,
  getAccountDeletionOwnershipBlockers,
  deleteUser,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
  getAccountDeletionOwnershipBlockers: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/account-deletion', () => ({
  getAccountDeletionOwnershipBlockers,
}))
vi.mock('@/lib/auth/auth', () => ({ auth: { api: { deleteUser } } }))
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

afterEach(() => vi.clearAllMocks())

describe('account deletion route', () => {
  it('requires authentication before reading confirmation or account data', async () => {
    getSession.mockResolvedValue(null)

    const response = await POST(
      new Request('http://localhost/api/v1/account/delete', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.test',
          password: 'secret',
        }),
      }),
    )

    expect(response.status).toBe(401)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('blocks sole-owner deletion before invoking authentication deletion', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.test' },
    })
    getConnectedDatabase.mockResolvedValue('db')
    getAccountDeletionOwnershipBlockers.mockResolvedValue([
      { listId: 'list-1', listName: 'Family', activeMemberCount: 2 },
    ])

    const response = await POST(
      new Request('http://localhost/api/v1/account/delete', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.test',
          password: 'secret',
        }),
      }),
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe(
      'ACCOUNT_DELETION_OWNERSHIP_BLOCKED',
    )
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('passes the confirmed password to Better Auth after readiness succeeds', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.test' },
    })
    getConnectedDatabase.mockResolvedValue('db')
    getAccountDeletionOwnershipBlockers.mockResolvedValue([])
    deleteUser.mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'User deleted' }), {
        status: 200,
      }),
    )

    const response = await POST(
      new Request('http://localhost/api/v1/account/delete', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.test',
          password: 'secret',
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      message: 'User deleted',
    })
    expect(deleteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { password: 'secret' },
        asResponse: true,
      }),
    )
  })
})
