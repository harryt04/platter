import { getConnectedDatabase } from '@/lib/db/mongo-client'
import { getSession } from '@/lib/auth/authorization'
import { isoDateTime } from '@/lib/contracts/ids'
import { problemResponse } from '@/lib/contracts/problem'
import { listIdSchema, listOwnerFilter, type ListDocument } from '@/lib/lists'
import { serverEnv } from '@/lib/env/server'
import {
  hashInvitationToken,
  invitationIdSchema,
  invitations,
  toInvitationSummary,
  type InvitationDocument,
} from '@/lib/invitations'
import { randomBytes } from 'node:crypto'

type RouteContext = {
  params: Promise<{ listId: string; invitationId: string }>
}

function authenticationRequired() {
  return problemResponse({
    type: 'https://platter.dev/problems/authentication-required',
    title: 'Authentication required',
    status: 401,
    detail: 'Sign in to manage invitations for a list.',
    code: 'AUTHENTICATION_REQUIRED',
  })
}

function listNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/list-not-found',
    title: 'List not found',
    status: 404,
    detail: 'That list is not available to you.',
    code: 'LIST_NOT_FOUND',
  })
}

function invitationNotFound() {
  return problemResponse({
    type: 'https://platter.dev/problems/invitation-not-found',
    title: 'Invitation not found',
    status: 404,
    detail: 'That invitation is not available for this list.',
    code: 'INVITATION_NOT_FOUND',
  })
}

function invitationNotPending() {
  return problemResponse({
    type: 'https://platter.dev/problems/invitation-not-pending',
    title: 'Invitation is no longer pending',
    status: 409,
    detail: 'Only pending invitations can be resent or revoked.',
    code: 'INVITATION_NOT_PENDING',
  })
}

async function findPendingInvitation(
  listId: string,
  invitationId: string,
  userId: string,
) {
  const db = await getConnectedDatabase()
  const list = await db
    .collection<ListDocument>('lists')
    .findOne(listOwnerFilter(listId, userId))
  if (!list) return { kind: 'list-not-found' as const }

  const invitation = await invitations(
    db.collection<InvitationDocument>('list_invitations'),
  ).findOne({ _id: invitationId, listId })
  if (!invitation) return { kind: 'invitation-not-found' as const }
  if (invitation.status !== 'pending') {
    return { kind: 'invitation-not-pending' as const }
  }
  return { kind: 'ok' as const, db, invitation }
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId, invitationId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !invitationIdSchema.safeParse(invitationId).success
  ) {
    return invitationNotFound()
  }

  const result = await findPendingInvitation(
    listId,
    invitationId,
    session.user.id,
  )
  if (result.kind === 'list-not-found') return listNotFound()
  if (result.kind === 'invitation-not-found') return invitationNotFound()
  if (result.kind === 'invitation-not-pending') return invitationNotPending()

  const now = new Date()
  const token = randomBytes(32).toString('base64url')
  const updated = await result.db
    .collection<InvitationDocument>('list_invitations')
    .findOneAndUpdate(
      { _id: invitationId, listId, status: 'pending' },
      {
        $set: {
          tokenHash: hashInvitationToken(token),
          expiresAt: isoDateTime(
            new Date(
              now.getTime() + serverEnv().INVITATION_TTL_HOURS * 60 * 60 * 1000,
            ),
          ),
          updatedAt: isoDateTime(now),
        },
      },
      { returnDocument: 'after' },
    )
  if (!updated) return invitationNotPending()

  const inviteUrl = new URL(
    `/invitations/${token}`,
    serverEnv().APP_URL,
  ).toString()
  return Response.json({ invitation: toInvitationSummary(updated, inviteUrl) })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession()
  if (!session) return authenticationRequired()

  const { listId, invitationId } = await context.params
  if (
    !listIdSchema.safeParse(listId).success ||
    !invitationIdSchema.safeParse(invitationId).success
  ) {
    return invitationNotFound()
  }

  const result = await findPendingInvitation(
    listId,
    invitationId,
    session.user.id,
  )
  if (result.kind === 'list-not-found') return listNotFound()
  if (result.kind === 'invitation-not-found') return invitationNotFound()
  if (result.kind === 'invitation-not-pending') return invitationNotPending()

  const revoked = await result.db
    .collection<InvitationDocument>('list_invitations')
    .findOneAndUpdate(
      { _id: invitationId, listId, status: 'pending' },
      { $set: { status: 'revoked', updatedAt: isoDateTime(new Date()) } },
      { returnDocument: 'after' },
    )
  if (!revoked) return invitationNotPending()

  return Response.json({ invitation: toInvitationSummary(revoked) })
}
