import type { Db } from 'mongodb'
import { z } from 'zod'
import {
  isoDateTime,
  opaqueIdSchema,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import type { InvitationDocument } from '@/lib/invitations'
import type { ListDocument } from '@/lib/lists'

/**
 * Notification events are intentionally limited to consequential membership
 * changes. Shopping activity has no event in this contract, so it cannot
 * reach in-product, email, or push notification delivery accidentally.
 */
export const notificationEventSchema = z.enum([
  'invitation',
  'role-changed',
  'removed',
])

export type NotificationEvent = z.infer<typeof notificationEventSchema>

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
  href: string
  title: string
  body: string
}

const notificationTimestampSchema = z.string().datetime()

/** Runtime boundary for documents read from the notifications collection. */
export const notificationDocumentSchema = z
  .object({
    _id: notificationIdSchema,
    userId: opaqueIdSchema,
    event: notificationEventSchema,
    listId: opaqueIdSchema,
    listName: z.string().min(1).max(2000),
    invitationId: opaqueIdSchema.optional(),
    role: z.enum(['owner', 'editor']).optional(),
    readAt: notificationTimestampSchema.optional(),
    createdAt: notificationTimestampSchema,
  })
  .strict()

/** Runtime boundary for notification API responses. */
export const notificationSummarySchema = z
  .object({
    id: notificationIdSchema,
    event: notificationEventSchema,
    listId: opaqueIdSchema,
    listName: z.string().min(1).max(2000),
    invitationId: opaqueIdSchema.optional(),
    role: z.enum(['owner', 'editor']).optional(),
    readAt: notificationTimestampSchema.optional(),
    createdAt: notificationTimestampSchema,
    href: z.string().regex(/^\/(?:lists|invitations)\//),
    title: z.string().min(1).max(2000),
    body: z.string().min(1).max(2000),
  })
  .strict()

export const notificationListResponseSchema = z
  .object({ notifications: z.array(notificationSummarySchema) })
  .strict()

export const notificationResponseSchema = z
  .object({ notification: notificationSummarySchema })
  .strict()

export const notificationInputSchema = z
  .object({
    userId: z.string().min(1),
    event: notificationEventSchema,
    listId: z.string().min(1),
    listName: z.string().min(1),
    invitationId: z.string().min(1).optional(),
    role: z.enum(['owner', 'editor']).optional(),
  })
  .strict()

type NotificationInput = z.infer<typeof notificationInputSchema>

export function notificationRecipientFilter(userId: string) {
  return { userId }
}

export function createNotificationDocument(
  input: NotificationInput,
  now = new Date(),
): NotificationDocument {
  const validated = notificationInputSchema.parse(input)
  return {
    ...validated,
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
  const validated = notificationDocumentSchema.parse(document)
  return notificationSummarySchema.parse({
    id: validated._id as EntityId,
    event: validated.event,
    listId: validated.listId as EntityId,
    listName: validated.listName,
    ...(validated.invitationId
      ? { invitationId: validated.invitationId as EntityId }
      : {}),
    ...(validated.role ? { role: validated.role } : {}),
    ...(validated.readAt ? { readAt: validated.readAt } : {}),
    createdAt: validated.createdAt,
    href: validated.invitationId
      ? `/invitations/notification/${validated._id}`
      : `/lists/${validated.listId}`,
    ...notificationCopy(document),
  }) as unknown as NotificationSummary
}

export async function findInvitationForNotification(
  db: Db,
  notificationId: string,
  userId: string,
) {
  const notification = await db
    .collection<NotificationDocument>('notifications')
    .findOne({
      _id: notificationId,
      ...notificationRecipientFilter(userId),
      event: 'invitation',
    })
  if (!notification?.invitationId) return null

  const invitation = await db
    .collection<InvitationDocument>('list_invitations')
    .findOne({ _id: notification.invitationId, listId: notification.listId })
  if (!invitation) return null

  const list = await db
    .collection<ListDocument>('lists')
    .findOne({ _id: notification.listId, status: { $ne: 'deleted' } })
  if (!list) return null

  return { notification, invitation, list }
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
