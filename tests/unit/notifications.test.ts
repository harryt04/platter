import { describe, expect, it, vi } from 'vitest'
import {
  createNotificationDocument,
  notifyExistingUserByEmail,
  notificationCopy,
} from '@/lib/notifications'

describe('notification contracts', () => {
  it('keeps notification copy limited to membership context', () => {
    const notification = createNotificationDocument(
      {
        userId: 'user-1',
        event: 'role-changed',
        listId: 'list-1',
        listName: 'Family',
        role: 'owner',
      },
      new Date('2026-09-10T12:00:00.000Z'),
    )

    expect(notificationCopy(notification)).toEqual({
      title: 'Your role changed in Family',
      body: 'You are now an owner of Family.',
    })
    expect(notification).not.toHaveProperty('recipe')
    expect(notification).not.toHaveProperty('grocery')
  })

  it('notifies an existing invited account without storing the email in the event', async () => {
    const insertOne = vi.fn().mockResolvedValue({ acknowledged: true })
    const users = {
      findOne: vi.fn().mockResolvedValue({
        _id: 'guest-1',
        email: 'guest@example.com',
      }),
    }
    const db = {
      collection: vi.fn((name: string) =>
        name === 'users' ? users : { insertOne },
      ),
    }

    await expect(
      notifyExistingUserByEmail(db as never, ' Guest@Example.com ', {
        event: 'invitation',
        listId: 'list-1',
        listName: 'Family',
        invitationId: 'invitation-1',
      }),
    ).resolves.toBe(true)

    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'guest-1',
        event: 'invitation',
        listName: 'Family',
        invitationId: 'invitation-1',
      }),
    )
    expect(insertOne.mock.calls[0]?.[0]).not.toHaveProperty('email')
  })
})
