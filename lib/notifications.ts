import type { Db } from 'mongodb'
import { z } from 'zod'
import {
  isoDateTime,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'

export type NotificationEvent = 'invitation' | 'role-changed' | 'removed'

export const notificationIdSchema = z
  .string()
  .uuid('Enter a valid notification id.')

export type NotificationDocument = {
  _id: string
  userId: string
  event: NotificationEvent
  listId: string
  listName: string
  invitationId?: string
  role?: 'owner' | 'editor'
  readAt?: IsoDateTime
  createdAt: IsoDateTime
}

export type NotificationSummary = {
  id: EntityId
  event: NotificationEvent
  listId: EntityId
  listName: string
  invitationId?: EntityId
  role?: 'owner' | 'editor'
  readAt?: IsoDateTime
  createdAt: IsoDateTime
  title: string
  body: string
}

type NotificationInput = Omit<
  NotificationDocument,
  '_id' | 'createdAt' | 'readAt'
>

export function createNotificationDocument(
  input: NotificationInput,
  now = new Date(),
): NotificationDocument {
  return {
    ...input,
    _id: crypto.randomUUID(),
    createdAt: isoDateTime(now),
  }
}

export function notificationCopy(document: NotificationDocument) {
  if (document.event === 'invitation') {
    return {
      title: `Invitation to ${document.listName}`,
      body: `You’ve been invited to collaborate on ${document.listName}.`,
    }
  }

  if (document.event === 'removed') {
    return {
      title: `Removed from ${document.listName}`,
      body: `You no longer have access to ${document.listName}.`,
    }
  }

  return {
    title: `Your role changed in ${document.listName}`,
    body: `You are now an ${document.role === 'owner' ? 'owner' : 'editor'} of ${document.listName}.`,
  }
}

export function toNotificationSummary(
  document: NotificationDocument,
): NotificationSummary {
  return {
    id: document._id as EntityId,
    event: document.event,
    listId: document.listId as EntityId,
    listName: document.listName,
    ...(document.invitationId
      ? { invitationId: document.invitationId as EntityId }
      : {}),
    ...(document.role ? { role: document.role } : {}),
    ...(document.readAt ? { readAt: document.readAt } : {}),
    createdAt: document.createdAt,
    ...notificationCopy(document),
  }
}

export async function createUserNotification(db: Db, input: NotificationInput) {
  await db
    .collection<NotificationDocument>('notifications')
    .insertOne(createNotificationDocument(input))
}

export async function notifyExistingUserByEmail(
  db: Db,
  email: string,
  input: Omit<NotificationInput, 'userId'>,
) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await db
    .collection<{ _id: string; email: string }>('users')
    .findOne({ email: normalizedEmail }, { projection: { _id: 1, email: 1 } })
  if (!user || user.email.trim().toLowerCase() !== normalizedEmail) {
    return false
  }

  await createUserNotification(db, { ...input, userId: user._id })
  return true
}

export async function safelyCreateUserNotification(
  db: Db,
  input: NotificationInput,
) {
  try {
    await createUserNotification(db, input)
  } catch {
    return false
  }
  return true
}
