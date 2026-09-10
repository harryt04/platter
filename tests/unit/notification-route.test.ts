import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/notifications/route'
import { PATCH } from '@/app/api/v1/notifications/[notificationId]/route'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

afterEach(() => {
  vi.clearAllMocks()
})

const notification = {
  _id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'guest-1',
  event: 'invitation' as const,
  listId: 'list-1',
  listName: 'Family',
  invitationId: '660e8400-e29b-41d4-a716-446655440000',
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

describe('notification routes', () => {
  it('requires authentication before reading notifications', async () => {
    getSession.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('returns only the signed-in user’s notifications', async () => {
    getSession.mockResolvedValue({ user: { id: 'guest-1' } })
    const query = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([notification]),
    }
    const collection = {
      find: vi.fn().mockReturnValue(query),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      notifications: [
        {
          id: notification._id,
          event: 'invitation',
          listId: 'list-1',
          listName: 'Family',
          invitationId: notification.invitationId,
          createdAt: notification.createdAt,
          href: `/invitations/notification/${notification._id}`,
          title: 'Invitation to Family',
          body: 'You’ve been invited to collaborate on Family.',
        },
      ],
    })
    expect(collection.find).toHaveBeenCalledWith({ userId: 'guest-1' })
    expect(query.limit).toHaveBeenCalledWith(50)
  })

  it('marks only an owned notification as read', async () => {
    getSession.mockResolvedValue({ user: { id: 'guest-1' } })
    const updated = {
      ...notification,
      readAt: '2026-09-10T12:01:00.000Z' as `${string}`,
    }
    const collection = {
      findOneAndUpdate: vi.fn().mockResolvedValue(updated),
    }
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue(collection),
    })

    const response = await PATCH(
      new Request('http://localhost/api/v1/notifications/notification', {
        method: 'PATCH',
      }),
      { params: Promise.resolve({ notificationId: notification._id }) },
    )

    expect(response.status).toBe(200)
    expect((await response.json()).notification.readAt).toBe(updated.readAt)
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: notification._id, userId: 'guest-1' },
      { $set: { readAt: expect.any(String) } },
      { returnDocument: 'after' },
    )
  })

  it('does not query for malformed notification ids', async () => {
    getSession.mockResolvedValue({ user: { id: 'guest-1' } })

    const response = await PATCH(
      new Request('http://localhost/api/v1/notifications/bad', {
        method: 'PATCH',
      }),
      { params: Promise.resolve({ notificationId: 'bad' }) },
    )

    expect(response.status).toBe(404)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })
})
