import { createHash, randomBytes } from 'node:crypto'
import type { Collection } from 'mongodb'
import { z } from 'zod'
import {
  isoDateTime,
  opaqueIdSchema,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { platterListSchema, type ListDocument } from '@/lib/lists'

export const createInvitationSchema = z.object({
  email: z
    .string({ error: 'Enter an email address.' })
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(320, 'Email addresses must be 320 characters or fewer.'),
})

export const invitationIdSchema = z
  .string()
  .uuid('Enter a valid invitation id.')

export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Enter a valid invitation token.')

/** Runtime boundary for invitation summaries exposed to list owners. */
export const invitationSummarySchema = z
  .object({
    id: invitationIdSchema,
    listId: z.string().min(1).max(100),
    email: z.string().email().max(320),
    status: z.enum(['pending', 'accepted', 'revoked']),
    expiresAt: z.string().datetime(),
    inviteUrl: z.string().url().optional(),
  })
  .strict()

/** Runtime boundary for owner invitation collection responses. */
export const invitationListResponseSchema = z
  .object({ invitations: z.array(invitationSummarySchema) })
  .strict()

/** Runtime boundary for a single owner invitation mutation response. */
export const invitationResponseSchema = z
  .object({ invitation: invitationSummarySchema })
  .strict()

/** Runtime boundary for invitation summaries exposed to recipients. */
export const invitationRecipientSummarySchema = z
  .object({
    listId: opaqueIdSchema,
    listName: z.string().min(1).max(100),
    email: z.string().email().max(320),
    status: z.enum(['pending', 'accepted', 'revoked']),
    expiresAt: z.string().datetime(),
  })
  .strict()

/** Runtime boundary for public invitation inspection responses. */
export const invitationRecipientResponseSchema = z
  .object({ invitation: invitationRecipientSummarySchema })
  .strict()

/** Runtime boundary for connected invitation acceptance responses. */
export const invitationAcceptanceResponseSchema = z
  .object({
    invitation: invitationRecipientSummarySchema,
    list: platterListSchema,
  })
  .strict()

export type InvitationStatus = 'pending' | 'accepted' | 'revoked'

export type InvitationDocument = {
  _id: string
  listId: string
  inviterId: string
  email: string
  tokenHash: string
  status: InvitationStatus
  expiresAt: IsoDateTime
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type InvitationSummary = {
  id: EntityId
  listId: EntityId
  email: string
  status: InvitationStatus
  expiresAt: IsoDateTime
  inviteUrl?: string
}

export type InvitationRecipientSummary = {
  listId: EntityId
  listName: string
  email: string
  status: InvitationStatus
  expiresAt: IsoDateTime
}

export function invitations(collection: Collection<InvitationDocument>) {
  return collection
}

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function createInvitationDocument(
  listId: string,
  inviterId: string,
  email: string,
  now = new Date(),
  ttlHours = 168,
): { document: InvitationDocument; token: string } {
  const timestamp = isoDateTime(now)
  const token = randomBytes(32).toString('base64url')
  const expiresAt = isoDateTime(
    new Date(now.getTime() + ttlHours * 60 * 60 * 1000),
  )

  return {
    token,
    document: {
      _id: crypto.randomUUID(),
      listId,
      inviterId,
      email,
      tokenHash: hashInvitationToken(token),
      status: 'pending',
      expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }
}

export function toInvitationSummary(
  document: InvitationDocument,
  inviteUrl?: string,
): InvitationSummary {
  const summary: InvitationSummary = {
    id: document._id as EntityId,
    listId: document.listId as EntityId,
    email: document.email,
    status: document.status,
    expiresAt: document.expiresAt,
  }
  if (inviteUrl) summary.inviteUrl = inviteUrl
  return summary
}

export function toInvitationRecipientSummary(
  document: InvitationDocument,
  listName: string,
): InvitationRecipientSummary {
  return {
    listId: document.listId as EntityId,
    listName,
    email: document.email,
    status: document.status,
    expiresAt: document.expiresAt,
  }
}

export function invitationIsExpired(
  document: Pick<InvitationDocument, 'expiresAt'>,
  now = new Date(),
) {
  return new Date(document.expiresAt).getTime() <= now.getTime()
}

export async function findInvitationByToken(token: string) {
  if (!invitationTokenSchema.safeParse(token).success) return null

  const db = await getConnectedDatabase()
  const invitation = await db
    .collection<InvitationDocument>('list_invitations')
    .findOne({ tokenHash: hashInvitationToken(token) })
  if (!invitation) return null

  const list = await db
    .collection<ListDocument>('lists')
    .findOne({ _id: invitation.listId, status: { $ne: 'deleted' } })
  if (!list) return null

  return { invitation, list }
}
