import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/account/deletion-readiness/route'

const {
  getSession,
  getConnectedDatabase,
  getAccountDeletionOwnershipBlockers,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
  getAccountDeletionOwnershipBlockers: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/account-deletion', () => ({
  getAccountDeletionOwnershipBlockers,
}))

afterEach(() => vi.clearAllMocks())

describe('account deletion readiness route', () => {
  it('requires authentication without querying account data', async () => {
    getSession.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('blocks deletion while the user owns a list alone', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockResolvedValue('db')
    getAccountDeletionOwnershipBlockers.mockResolvedValue([
      { listId: 'list-1', listName: 'Family', activeMemberCount: 2 },
    ])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      readiness: {
        canDelete: false,
        ownershipBlockers: [
          { listId: 'list-1', listName: 'Family', activeMemberCount: 2 },
        ],
      },
    })
    expect(getAccountDeletionOwnershipBlockers).toHaveBeenCalledWith(
      'db',
      'user-1',
    )
  })

  it('allows the ownership prerequisite after every sole-owner list is resolved', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockResolvedValue('db')
    getAccountDeletionOwnershipBlockers.mockResolvedValue([])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      readiness: { canDelete: true, ownershipBlockers: [] },
    })
  })

  it('returns a stable problem response when readiness cannot load', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database unavailable'))

    const response = await GET()

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      code: 'ACCOUNT_DELETION_READINESS_FAILED',
    })
  })
})
