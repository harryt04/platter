import { getSession } from '@/lib/auth/authorization'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { problemResponse } from '@/lib/contracts/problem'
import {
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

export async function GET() {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const db = await getConnectedDatabase()
  const documents = await db
    .collection<NotificationDocument>('notifications')
    .find(notificationRecipientFilter(session.user.id))
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  return Response.json({
    notifications: documents.map(toNotificationSummary),
  })
}
