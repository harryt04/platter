import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/account/deletion-impact/route'

const { getSession, getConnectedDatabase, getAccountDeletionImpact } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    getConnectedDatabase: vi.fn(),
    getAccountDeletionImpact: vi.fn(),
  }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/account-deletion', async () => {
  const actual = await vi.importActual<typeof import('@/lib/account-deletion')>(
    '@/lib/account-deletion',
  )
  return { ...actual, getAccountDeletionImpact }
})

afterEach(() => vi.clearAllMocks())

describe('account deletion impact route', () => {
  it('requires authentication without querying account data', async () => {
    getSession.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('returns the signed-in user’s deletion impact', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockResolvedValue('db')
    getAccountDeletionImpact.mockResolvedValue({
      ownedLists: 2,
      soleOwnerLists: ['Family'],
      soleOwnerListDetails: [
        { listId: 'list-1', listName: 'Family', activeMemberCount: 1 },
      ],
      memberships: 3,
      manuallyAuthoredRecipes: 4,
      publicImportedRecipes: 1,
      completedShoppingRuns: 5,
    })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      impact: {
        ownedLists: 2,
        soleOwnerLists: ['Family'],
        soleOwnerListDetails: [
          { listId: 'list-1', listName: 'Family', activeMemberCount: 1 },
        ],
        memberships: 3,
        manuallyAuthoredRecipes: 4,
        publicImportedRecipes: 1,
        completedShoppingRuns: 5,
      },
    })
    expect(getAccountDeletionImpact).toHaveBeenCalledWith('db', 'user-1')
  })

  it('returns a stable problem response when the summary cannot load', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database unavailable'))

    const response = await GET()

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'ACCOUNT_DELETION_IMPACT_FAILED',
      detail:
        'We couldn’t load the account deletion details. Try again shortly.',
    })
  })

  it('hides malformed computed summaries behind the same retryable problem', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    getConnectedDatabase.mockResolvedValue('db')
    getAccountDeletionImpact.mockResolvedValue({
      ownedLists: -1,
      soleOwnerLists: [],
      soleOwnerListDetails: [],
      memberships: 0,
      manuallyAuthoredRecipes: 0,
      publicImportedRecipes: 0,
      completedShoppingRuns: 0,
    })

    const response = await GET()

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'ACCOUNT_DELETION_IMPACT_FAILED',
    })
  })
})
