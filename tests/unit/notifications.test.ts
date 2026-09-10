import { describe, expect, it, vi } from 'vitest'
import {
  createNotificationDocument,
  notifyExistingUserByEmail,
  notificationEventSchema,
  notificationInputSchema,
  notificationCopy,
  notificationRecipientFilter,
  toNotificationSummary,
} from '@/lib/notifications'

describe('notification contracts', () => {
  it('allows only membership changes into the notification pipeline', () => {
    expect(notificationEventSchema.options).toEqual([
      'invitation',
      'role-changed',
      'removed',
    ])
    expect(notificationEventSchema.safeParse('grocery-purchased').success).toBe(
      false,
    )
    expect(notificationEventSchema.safeParse('grocery-edited').success).toBe(
      false,
    )
  })

  it('rejects routine grocery event payloads at the persistence boundary', () => {
    expect(() =>
      notificationInputSchema.parse({
        userId: 'user-1',
        event: 'grocery-purchased',
        listId: 'list-1',
        listName: 'Family',
      }),
    ).toThrow()
    expect(() =>
      notificationInputSchema.parse({
        userId: 'user-1',
        event: 'grocery-edited',
        listId: 'list-1',
        listName: 'Family',
      }),
    ).toThrow()
  })

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

  it('rejects recipe and grocery fields at the notification persistence boundary', () => {
    expect(() =>
      createNotificationDocument({
        userId: 'user-1',
        event: 'removed',
        listId: 'list-1',
        listName: 'Family',
        recipe: 'recipe content',
      } as never),
    ).toThrow()
    expect(() =>
      createNotificationDocument({
        userId: 'user-1',
        event: 'removed',
        listId: 'list-1',
        listName: 'Family',
        grocery: ['onions'],
      } as never),
    ).toThrow()
  })

  it('uses the recipient as the sole notification authorization scope', () => {
    expect(notificationRecipientFilter('user-1')).toEqual({ userId: 'user-1' })
  })

  it('links invitation notifications to their authenticated invitation view', () => {
    const summary = toNotificationSummary(
      createNotificationDocument({
        userId: 'user-1',
        event: 'invitation',
        listId: 'list-1',
        listName: 'Family',
        invitationId: 'invitation-1',
      }),
    )

    expect(summary.href).toBe(`/invitations/notification/${summary.id}`)
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
