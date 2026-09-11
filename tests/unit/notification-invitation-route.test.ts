import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GET,
  POST,
} from '@/app/api/v1/invitations/notifications/[notificationId]/route'
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

const notificationId = '550e8400-e29b-41d4-a716-446655440000'
const invitationId = '660e8400-e29b-41d4-a716-446655440000'

const notification = {
  _id: notificationId,
  userId: 'guest-1',
  event: 'invitation' as const,
  listId: 'list-1',
  listName: 'Family',
  invitationId,
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

const invitation = {
  _id: invitationId,
  listId: 'list-1',
  inviterId: 'owner-1',
  email: 'guest@example.com',
  tokenHash: 'stored-hash',
  status: 'pending' as const,
  expiresAt: '2099-09-17T12:00:00.000Z' as `${string}`,
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
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

function context(id = notificationId) {
  return { params: Promise.resolve({ notificationId: id }) }
}

function database(overrides?: {
  invitation?: unknown
  list?: unknown
  notification?: unknown
}) {
  const notificationValue =
    overrides?.notification === undefined
      ? notification
      : overrides.notification
  const invitationValue =
    overrides?.invitation === undefined ? invitation : overrides.invitation
  const listValue = overrides?.list === undefined ? list : overrides.list
  const notificationCollection = {
    findOne: vi.fn().mockResolvedValue(notificationValue),
  }
  const invitationCollection = {
    findOne: vi.fn().mockResolvedValue(invitationValue),
    findOneAndUpdate: vi.fn().mockResolvedValue(invitationValue),
  }
  const listCollection = {
    findOne: vi.fn().mockResolvedValue(listValue),
    findOneAndUpdate: vi.fn().mockResolvedValue({
      ...list,
      members: [
        ...list.members,
        {
          userId: 'guest-1',
          role: 'editor' as const,
          invitationState: 'active' as const,
        },
      ],
    }),
  }
  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'notifications') return notificationCollection
      if (name === 'list_invitations') return invitationCollection
      return listCollection
    }),
  }
  return { db, notificationCollection, invitationCollection, listCollection }
}

describe('notification invitation routes', () => {
  it('returns only the signed-in recipient’s pending invitation', async () => {
    getSession.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
    })
    const { db, notificationCollection } = database()
    getConnectedDatabase.mockResolvedValue(db)

    const response = await GET(
      new Request('http://localhost/api/v1/invitations/notifications/id'),
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
    expect(notificationCollection.findOne).toHaveBeenCalledWith({
      _id: notificationId,
      userId: 'guest-1',
      event: 'invitation',
    })
  })

  it('accepts the notification invitation transactionally without needing the raw token', async () => {
    getSession.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
    })
    const { db, invitationCollection, listCollection } = database()
    getConnectedDatabase.mockResolvedValue(db)
    getMongoClient.mockReturnValue({
      withSession: async (callback: (session: unknown) => unknown) =>
        callback({
          withTransaction: async (transaction: (session: unknown) => unknown) =>
            transaction({}),
        }),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/invitations/notifications/id', {
        method: 'POST',
      }),
      context(),
    )

    expect(response.status).toBe(200)
    expect((await response.json()).list.id).toBe('list-1')
    expect(invitationCollection.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: invitationId,
        status: 'pending',
        expiresAt: { $gt: expect.any(String) },
      },
      { $set: { status: 'accepted', updatedAt: expect.any(String) } },
      { returnDocument: 'after', session: expect.anything() },
    )
    expect(listCollection.findOneAndUpdate).toHaveBeenCalled()
  })

  it('does not query for malformed or foreign notification ids', async () => {
    getSession.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
    })
    const { db } = database({ notification: null })
    getConnectedDatabase.mockResolvedValue(db)

    const malformed = await GET(
      new Request('http://localhost/api/v1/invitations/notifications/bad'),
      context('bad'),
    )
    const foreign = await GET(
      new Request('http://localhost/api/v1/invitations/notifications/id'),
      context(),
    )

    expect(malformed.status).toBe(404)
    expect(foreign.status).toBe(404)
  })

  it('hides malformed invitation data behind a retryable problem', async () => {
    getSession.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
    })
    const { db } = database({
      invitation: { ...invitation, expiresAt: 'not-a-timestamp' },
    })
    getConnectedDatabase.mockResolvedValue(db)

    const response = await GET(
      new Request('http://localhost/api/v1/invitations/notifications/id'),
      context(),
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(await response.json()).toMatchObject({
      code: 'INVITATION_UNAVAILABLE',
    })
  })

  it('hides invitation storage failures behind a retryable problem', async () => {
    getSession.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
    })
    getConnectedDatabase.mockRejectedValue(new Error('database details'))

    const response = await GET(
      new Request('http://localhost/api/v1/invitations/notifications/id'),
      context(),
    )

    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain(
      'database details',
    )
  })

  it('hides acceptance storage failures behind a retryable problem', async () => {
    getSession.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
    })
    getConnectedDatabase.mockRejectedValue(new Error('database details'))

    const response = await POST(
      new Request('http://localhost/api/v1/invitations/notifications/id', {
        method: 'POST',
      }),
      context(),
    )

    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain(
      'database details',
    )
  })

  it('hides malformed accepted-list data behind a retryable problem', async () => {
    getSession.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
    })
    const { db } = database({
      list: {
        ...list,
        activeRunId: '',
        members: [
          ...list.members,
          {
            userId: 'guest-1',
            role: 'editor' as const,
            invitationState: 'active' as const,
          },
        ],
      },
    })
    getConnectedDatabase.mockResolvedValue(db)
    getMongoClient.mockReturnValue({
      withSession: async (callback: (session: unknown) => unknown) =>
        callback({
          withTransaction: async (transaction: (session: unknown) => unknown) =>
            transaction({}),
        }),
    })

    const response = await POST(
      new Request('http://localhost/api/v1/invitations/notifications/id', {
        method: 'POST',
      }),
      context(),
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'INVITATION_UNAVAILABLE',
    })
  })
})
