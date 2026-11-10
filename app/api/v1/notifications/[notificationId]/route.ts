import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import {
  notificationIdSchema,
  notificationResponseSchema,
  notificationRecipientFilter,
  toNotificationSummary,
  type NotificationDocument,
} from '@/lib/notifications'

type RouteContext = { params: Promise<{ notificationId: string }> }

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to update your notifications.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function notificationNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/notification-not-found',
    title: 'Notification not found',
    status: 404,
    detail: 'That notification is not available to you.',
    code: 'NOTIFICATION_NOT_FOUND',
  })
}

function notificationUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/notification-unavailable',
    title: 'Notification temporarily unavailable',
    status: 503,
    detail: 'That notification could not be updated. Try again shortly.',
    code: 'NOTIFICATION_UNAVAILABLE',
  })
}

export async function PATCH(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { notificationId } = await context.params
  if (!notificationIdSchema.safeParse(notificationId).success) {
    return notificationNotFound()
  }

  try {
    const updated = await (
      await getConnectedDatabase()
    )
      .collection<NotificationDocument>('notifications')
      .findOneAndUpdate(
        {
          _id: notificationId,
          ...notificationRecipientFilter(session.user.id),
        },
        { $set: { readAt: isoDateTime(new Date()) } },
        { returnDocument: 'after' },
      )
    if (!updated) return notificationNotFound()

    return Response.json(
      notificationResponseSchema.parse({
        notification: toNotificationSummary(updated),
      }),
    )
  } catch {
    return notificationUnavailable()
  }
}
