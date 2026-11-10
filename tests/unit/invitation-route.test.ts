import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/v1/lists/[listId]/invitations/route'
import {
  DELETE,
  POST as RESEND,
} from '@/app/api/v1/lists/[listId]/invitations/[invitationId]/route'
import { resetRateLimitsForTests } from '@/lib/security/rate-limit'

const { getSession, getConnectedDatabase, sendInvitationEmail } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    getConnectedDatabase: vi.fn(),
    sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
  }),
)

afterEach(() => {
  vi.clearAllMocks()
  resetRateLimitsForTests()
})

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/auth/mailer', () => ({ sendInvitationEmail }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

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
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

function context(listId: string) {
  return { params: Promise.resolve({ listId }) }
}

const invitation = {
  _id: '550e8400-e29b-41d4-a716-446655440000',
  listId: 'list-1',
  inviterId: 'owner-1',
  email: 'guest@example.com',
  tokenHash: 'stored-hash',
  status: 'pending' as const,
  expiresAt: '2026-09-17T12:00:00.000Z' as `${string}`,
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

function invitationContext(listId = 'list-1', invitationId = invitation._id) {
  return { params: Promise.resolve({ listId, invitationId }) }
}

describe('POST /api/v1/lists/[listId]/invitations', () => {
  it('requires authentication without querying the database', async () => {
    getSession.mockResolvedValue(null)
    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'guest@example.com' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(401)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('does not query for malformed list ids', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-%00-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'guest@example.com' }),
      }),
      context('list-\u0000-1'),
    )

    expect(response.status).toBe(404)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('hides invitations from editors and non-members', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    const collection = { findOne: vi.fn().mockResolvedValue(null) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'guest@example.com' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
    expect(collection.findOne).toHaveBeenCalledWith({
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: {
          userId: 'editor-1',
          role: 'owner',
          invitationState: 'active',
        },
      },
    })
  })

  it('validates the recipient email before creating an invitation', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const collection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(422)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
  })

  it('creates a pending invitation with a shareable URL and hashed token', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(list),
      insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: '  Guest@Example.com ' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.invitation).toMatchObject({
      listId: 'list-1',
      email: 'guest@example.com',
      status: 'pending',
    })
    const token = body.invitation.inviteUrl.split('/').at(-1)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const stored = collection.insertOne.mock.calls[0][0]
    expect(stored).toMatchObject({
      listId: 'list-1',
      inviterId: 'owner-1',
      email: 'guest@example.com',
      status: 'pending',
    })
    expect(stored.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    )
    expect(stored).not.toHaveProperty('token')
    expect(sendInvitationEmail).toHaveBeenCalledWith(
      'guest@example.com',
      body.invitation.inviteUrl,
      'Family',
    )
  })

  it('keeps the in-product invitation when email delivery fails', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    sendInvitationEmail.mockRejectedValueOnce(new Error('SMTP unavailable'))
    const collection = {
      findOne: vi.fn().mockResolvedValue(list),
      insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'guest@example.com' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(201)
    expect((await response.json()).invitation.status).toBe('pending')
  })

  it('limits invitation creation for an owner and returns a retry hint', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const collection = {
      findOne: vi.fn().mockResolvedValue(list),
      insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const responses = await Promise.all(
      Array.from({ length: 21 }, () =>
        POST(
          new Request('http://localhost/api/v1/lists/list-1/invitations', {
            method: 'POST',
            body: JSON.stringify({ email: 'guest@example.com' }),
          }),
          context('list-1'),
        ),
      ),
    )

    expect(
      responses.slice(0, 20).every((response) => response.status === 201),
    ).toBe(true)
    expect(responses[20]?.status).toBe(429)
    expect(responses[20]?.headers.get('Retry-After')).toMatch(/^\d+$/)
    expect(collection.insertOne).toHaveBeenCalledTimes(20)
  })
})

describe('GET /api/v1/lists/[listId]/invitations', () => {
  it('returns invitation metadata only to an owner', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const invitationCollection = {
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([invitation]),
        }),
      }),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi
        .fn()
        .mockReturnValueOnce(listCollection)
        .mockReturnValue(invitationCollection),
    })

    const response = await GET(
      new Request('http://localhost/api/v1/lists/list-1/invitations'),
      context('list-1'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      invitations: [
        {
          id: invitation._id,
          listId: 'list-1',
          email: 'guest@example.com',
          status: 'pending',
          expiresAt: invitation.expiresAt,
        },
      ],
    })
    expect(invitationCollection.find).toHaveBeenCalledWith({ listId: 'list-1' })
  })

  it('hides invitation metadata from editors', async () => {
    getSession.mockResolvedValue({ user: { id: 'editor-1' } })
    const collection = { findOne: vi.fn().mockResolvedValue(null) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await GET(
      new Request('http://localhost/api/v1/lists/list-1/invitations'),
      context('list-1'),
    )

    expect(response.status).toBe(404)
    expect((await response.json()).code).toBe('LIST_NOT_FOUND')
  })

  it('returns a stable retryable problem when invitation storage is unavailable', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await GET(
      new Request('http://localhost/api/v1/lists/list-1/invitations'),
      context('list-1'),
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(await response.json()).toEqual({
      type: 'https://platter.dev/problems/invitations-unavailable',
      title: 'Invitations are temporarily unavailable',
      status: 503,
      detail: 'Invitations could not be loaded. Please try again shortly.',
      code: 'INVITATIONS_UNAVAILABLE',
    })
  })

  it('does not expose malformed persisted invitation metadata', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const invitationCollection = {
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          toArray: vi
            .fn()
            .mockResolvedValue([{ ...invitation, email: 'not-an-email' }]),
        }),
      }),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi
        .fn()
        .mockReturnValueOnce(listCollection)
        .mockReturnValue(invitationCollection),
    })

    const response = await GET(
      new Request('http://localhost/api/v1/lists/list-1/invitations'),
      context('list-1'),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('INVITATIONS_UNAVAILABLE')
  })
})

describe('invitation management routes', () => {
  it('returns a stable retryable problem when creating an invitation cannot reach storage', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await POST(
      new Request('http://localhost/api/v1/lists/list-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: 'guest@example.com' }),
      }),
      context('list-1'),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('INVITATIONS_UNAVAILABLE')
  })

  it('resends a pending invitation with a rotated token and fresh expiry', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue(invitation),
      findOneAndUpdate: vi.fn().mockImplementation(async (_filter, update) => ({
        ...invitation,
        ...update.$set,
      })),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi
        .fn()
        .mockReturnValueOnce(listCollection)
        .mockReturnValue(invitationCollection),
    })

    const response = await RESEND(
      new Request('http://localhost/api/v1/lists/list-1/invitations/id', {
        method: 'POST',
      }),
      invitationContext(),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.invitation).toMatchObject({
      id: invitation._id,
      email: invitation.email,
      status: 'pending',
    })
    const inviteUrl = new URL(body.invitation.inviteUrl)
    expect(inviteUrl.origin).toBe(
      process.env.APP_URL ?? 'http://localhost:3000',
    )
    expect(inviteUrl.pathname).toMatch(/^\/invitations\/[A-Za-z0-9_-]{43}$/)
    const update = invitationCollection.findOneAndUpdate.mock.calls[0][1]
    expect(update.$set.tokenHash).not.toBe(invitation.tokenHash)
    expect(update.$set.expiresAt).not.toBe(invitation.expiresAt)
    expect(sendInvitationEmail).toHaveBeenCalledWith(
      invitation.email,
      body.invitation.inviteUrl,
      list.name,
    )
  })

  it('revokes a pending invitation and does not expose its token', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue(invitation),
      findOneAndUpdate: vi.fn().mockResolvedValue({
        ...invitation,
        status: 'revoked',
      }),
    }
    const listCollection = { findOne: vi.fn().mockResolvedValue(list) }
    getConnectedDatabase.mockResolvedValue({
      collection: vi
        .fn()
        .mockReturnValueOnce(listCollection)
        .mockReturnValue(invitationCollection),
    })

    const response = await DELETE(
      new Request('http://localhost/api/v1/lists/list-1/invitations/id', {
        method: 'DELETE',
      }),
      invitationContext(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      invitation: {
        id: invitation._id,
        listId: invitation.listId,
        email: invitation.email,
        status: 'revoked',
        expiresAt: invitation.expiresAt,
      },
    })
    expect(invitationCollection.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: invitation._id,
        listId: invitation.listId,
        status: 'pending',
      },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'revoked' }),
      }),
      { returnDocument: 'after' },
    )
  })

  it('rejects management for an accepted invitation', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const invitationCollection = {
      findOne: vi.fn().mockResolvedValue({ ...invitation, status: 'accepted' }),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi
        .fn()
        .mockReturnValueOnce({ findOne: vi.fn().mockResolvedValue(list) })
        .mockReturnValueOnce(invitationCollection),
    })

    const response = await RESEND(
      new Request('http://localhost/api/v1/lists/list-1/invitations/id', {
        method: 'POST',
      }),
      invitationContext(),
    )

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('INVITATION_NOT_PENDING')
  })

  it('returns a stable retryable problem when resending cannot reach storage', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await RESEND(
      new Request('http://localhost/api/v1/lists/list-1/invitations/id', {
        method: 'POST',
      }),
      invitationContext(),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('INVITATIONS_UNAVAILABLE')
  })

  it('returns a stable retryable problem when revoking cannot reach storage', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    getConnectedDatabase.mockRejectedValue(new Error('database offline'))

    const response = await DELETE(
      new Request('http://localhost/api/v1/lists/list-1/invitations/id', {
        method: 'DELETE',
      }),
      invitationContext(),
    )

    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('INVITATIONS_UNAVAILABLE')
  })
})
