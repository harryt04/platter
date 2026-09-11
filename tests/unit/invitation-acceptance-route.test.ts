import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/v1/invitations/[token]/route'
import { resetRateLimitsForTests } from '@/lib/security/rate-limit'

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

afterEach(() => {
  vi.clearAllMocks()
  resetRateLimitsForTests()
})

const token = 'a'.repeat(43)
const invitation = {
  _id: '550e8400-e29b-41d4-a716-446655440000',
  listId: 'list-1',
  inviterId: 'owner-1',
  email: 'guest@example.com',
  tokenHash: createHash('sha256').update(token).digest('hex'),
  status: 'pending' as const,
  expiresAt: '2099-09-10T12:00:00.000Z' as `${string}`,
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}
const list = {
  _id: 'list-1',
  name: 'Family',
  ownerIds: ['owner-1'],
  status: 'active' as const,
  activeRunId: 'run-1',
  members: [
    {
      userId: 'owner-1',
      role: 'owner' as const,
      invitationState: 'active' as const,
    },
  ],
  createdAt: invitation.createdAt,
  updatedAt: invitation.updatedAt,
}

function context(value = token) {
  return { params: Promise.resolve({ token: value }) }
}

function database(
  invitationCollection: Record<string, unknown>,
  listCollection: Record<string, unknown>,
) {
  return {
    collection: vi.fn((name: string) =>
      name === 'list_invitations' ? invitationCollection : listCollection,
    ),
  }
}

describe('invitation recipient route', () => {
  it('does not query for malformed tokens', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/invitations/bad'),
      context('bad'),
    )

    expect(response.status).toBe(404)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('returns a safe invitation summary for a pending token', async () => {
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue(invitation),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue(
      database(invitationCollection, listCollection),
    )

    const response = await GET(
      new Request(`http://localhost/api/v1/invitations/${token}`),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      invitation: {
        listId: 'list-1',
        listName: 'Family',
        email: 'guest@example.com',
        status: 'pending',
        expiresAt: invitation.expiresAt,
      },
    })
  })

  it('hides invitation lookup failures behind a stable retryable problem', async () => {
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await GET(
      new Request(`http://localhost/api/v1/invitations/${token}`),
      context(),
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    const body = await response.json()
    expect(body).toEqual({
      type: 'https://platter.dev/problems/invitation-unavailable',
      title: 'Invitation temporarily unavailable',
      status: 503,
      detail: 'The invitation could not be loaded. Try again shortly.',
      code: 'INVITATION_UNAVAILABLE',
    })
    expect(JSON.stringify(body)).not.toContain('database offline')
  })

  it('hides malformed persisted invitation summaries behind the same problem', async () => {
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue({ ...invitation, email: 'invalid' }),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue(
      database(invitationCollection, listCollection),
    )

    const response = await GET(
      new Request(`http://localhost/api/v1/invitations/${token}`),
      context(),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('INVITATION_UNAVAILABLE')
  })

  it('reports expired invitations without exposing recipient account details', async () => {
    const expiredInvitation = {
      ...invitation,
      expiresAt: '2020-09-10T12:00:00.000Z' as `${string}`,
    }
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue(expiredInvitation),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue(
      database(invitationCollection, listCollection),
    )

    const response = await GET(
      new Request(`http://localhost/api/v1/invitations/${token}`),
      context(),
    )

    expect(response.status).toBe(410)
    expect((await response.json()).code).toBe('INVITATION_EXPIRED')
  })

  it.each([
    ['revoked', 'INVITATION_UNAVAILABLE'],
    ['accepted', 'INVITATION_UNAVAILABLE'],
  ] as const)(
    'reports %s invitations without revealing account details',
    async (status, code) => {
      const unavailableInvitation = {
        ...invitation,
        status,
      }
      const invitationCollection = {
        findOne: vi.fn().mockResolvedValue(unavailableInvitation),
      }
      const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
      getConnectedDatabase.mockResolvedValue(
        database(invitationCollection, listCollection),
      )

      const response = await GET(
        new Request(`http://localhost/api/v1/invitations/${token}`),
        context(),
      )

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({
        code,
        detail: 'This invitation has already been used or revoked.',
      })
    },
  )

  it('returns the same unavailable outcome when a terminal invitation is posted', async () => {
    getSession.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
    })
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue({
        ...invitation,
        status: 'accepted' as const,
      }),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue(
      database(invitationCollection, listCollection),
    )

    const response = await POST(
      new Request(`http://localhost/api/v1/invitations/${token}`, {
        method: 'POST',
      }),
      context(),
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('INVITATION_UNAVAILABLE')
    expect(getMongoClient).not.toHaveBeenCalled()
  })

  it('requires authentication before accepting', async () => {
    getSession.mockResolvedValue(null)

    const response = await POST(
      new Request(`http://localhost/api/v1/invitations/${token}`, {
        method: 'POST',
      }),
      context(),
    )

    expect(response.status).toBe(401)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('rejects an authenticated account whose email is not invited', async () => {
    getSession.mockResolvedValue({
      user: { id: 'other-1', email: 'other@example.com' },
    })
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue(invitation),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue(
      database(invitationCollection, listCollection),
    )

    const response = await POST(
      new Request(`http://localhost/api/v1/invitations/${token}`, {
        method: 'POST',
      }),
      context(),
    )

    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('INVITATION_ACCOUNT_MISMATCH')
  })

  it('limits acceptance attempts by client and returns a retry hint', async () => {
    getSession.mockResolvedValue({
      user: { id: 'other-1', email: 'other@example.com' },
    })
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue(invitation),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue(
      database(invitationCollection, listCollection),
    )

    const responses = await Promise.all(
      Array.from({ length: 11 }, () =>
        POST(
          new Request(`http://localhost/api/v1/invitations/${token}`, {
            method: 'POST',
            headers: { 'x-forwarded-for': '203.0.113.9' },
          }),
          context(),
        ),
      ),
    )

    expect(
      responses.slice(0, 10).every((response) => response.status === 403),
    ).toBe(true)
    expect(responses[10]?.status).toBe(429)
    expect(responses[10]?.headers.get('Retry-After')).toMatch(/^\d+$/)
  })

  it('accepts atomically and adds the invited account as an editor', async () => {
    getSession.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
    })
    const acceptedInvitation = { ...invitation, status: 'accepted' as const }
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue(invitation),
      findOneAndUpdate: vi.fn().mockResolvedValue(acceptedInvitation),
    }
    const acceptedList = {
      ...list,
      members: [
        ...list.members,
        {
          userId: 'guest-1',
          role: 'editor' as const,
          invitationState: 'active' as const,
        },
      ],
    }
    const listCollection = {
      findOne: vi.fn().mockResolvedValue(list),
      findOneAndUpdate: vi.fn().mockResolvedValue(acceptedList),
    }
    getConnectedDatabase.mockResolvedValue(
      database(invitationCollection, listCollection),
    )
    const transactionSession = {}
    getMongoClient.mockReturnValue({
      withSession: vi.fn(
        async (
          callback: (session: typeof transactionSession) => Promise<void>,
        ) =>
          callback({
            withTransaction: (
              transaction: (
                session: typeof transactionSession,
              ) => Promise<void>,
            ) => transaction(transactionSession),
          } as never),
      ),
    })

    const response = await POST(
      new Request(`http://localhost/api/v1/invitations/${token}`, {
        method: 'POST',
      }),
      context(),
    )

    expect(response.status).toBe(200)
    expect((await response.json()).list.name).toBe('Family')
    expect(invitationCollection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        tokenHash: invitation.tokenHash,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'accepted' }),
      }),
      expect.objectContaining({ session: transactionSession }),
    )
    expect(listCollection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'members.userId': { $ne: 'guest-1' } }),
      expect.objectContaining({ $addToSet: expect.any(Object) }),
      expect.objectContaining({ session: transactionSession }),
    )
  })
})
