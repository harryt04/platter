import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { problemResponse } from '@/lib/contracts/problem'
import {
  notificationListResponseSchema,
  notificationRecipientFilter,
  toNotificationSummary,
  type NotificationDocument,
} from '@/lib/notifications'

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to view your notifications.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function notificationsUnavailable() {
  return problemResponse({
    type: 'https://platter.dev/problems/notifications-unavailable',
    title: 'Notifications temporarily unavailable',
    status: 503,
    detail: 'Notifications could not be loaded. Try again shortly.',
    code: 'NOTIFICATIONS_UNAVAILABLE',
  })
}

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired()

  try {
    const db = await getConnectedDatabase()
    const documents = await db
      .collection<NotificationDocument>('notifications')
      .find(notificationRecipientFilter(session.user.id))
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()
    const response = notificationListResponseSchema.parse({
      notifications: documents.map(toNotificationSummary),
    })
    return Response.json(response)
  } catch {
    return notificationsUnavailable()
  }
}
