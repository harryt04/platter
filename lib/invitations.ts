import { createHash, randomBytes } from 'node:crypto'
import type { Collection } from 'mongodb'
import { z } from 'zod'
import {
  isoDateTime,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'

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
